import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AtenderProtocolo } from "../../src/application/protocolo/AtenderProtocolo";
import { CPF_VALIDO, auditoriaFalsa, recusa, semTransacao } from "../ajudantes/dobras";

type Opcoes = {
  assunto?: { id: string; nome: string; setorId: string | null; ativo: boolean };
  primeiraEtapa?: { setorId: string; departamentoId: string | null } | null;
  requerenteExistente?: { id: string } | null;
  aberturasRecentes?: number;
};

const montar = (opcoes: Opcoes = {}) => {
  const gravado = {
    requerentes: [] as Record<string, unknown>[],
    atendimentos: [] as Record<string, unknown>[],
    contatos: [] as Record<string, unknown>[],
    consultasDeFreio: [] as { documento: string; desde: Date }[],
  };
  const assunto = opcoes.assunto
    ?? { id: "as-1", nome: "Certidão", setorId: "set-1", ativo: true };
  const auditoria = auditoriaFalsa();

  const protocolo = {
    buscarAssunto: async (_orgao: string, id: string) =>
      (id === assunto.id ? { ...assunto, atendimentos: 0 } : null),
    contarAberturasRecentes: async (documento: string, desde: Date) => {
      gravado.consultasDeFreio.push({ documento, desde });
      return opcoes.aberturasRecentes ?? 0;
    },
    buscarRequerentePorDocumento: async () => opcoes.requerenteExistente ?? null,
    criarRequerente: async (dados: Record<string, unknown>) => {
      gravado.requerentes.push(dados);
      return `req-${gravado.requerentes.length}`;
    },
    atualizarContato: async (id: string, dados: Record<string, unknown>) => {
      gravado.contatos.push({ id, ...dados });
    },
    criarAtendimento: async (dados: Record<string, unknown>) => {
      gravado.atendimentos.push(dados);
      return `proc-${gravado.atendimentos.length}`;
    },
  };
  const fluxos = { primeiraEtapa: async () => opcoes.primeiraEtapa ?? null };
  const numeracao = {
    gerarPar: async () => ({ protocolo: "000001/2026", processoAdm: "001/2026" }),
  };

  return {
    gravado,
    auditados: auditoria.registros,
    caso: new AtenderProtocolo(
      protocolo as never, fluxos as never, numeracao as never,
      auditoria.porta as never, semTransacao as never,
    ),
  };
};

const pedido = (extra: Record<string, unknown> = {}) => ({
  orgaoId: "org-1",
  assuntoId: "as-1",
  descricaoPedido: "Preciso de certidão negativa de débitos municipais.",
  origem: "BALCAO" as const,
  usuarioId: "u-1",
  requerente: {
    tipo: "CIDADAO" as const,
    documento: "529.982.247-25",
    nome: "Maria da Silva",
    contatoEmail: "maria@exemplo.com",
  },
  ...extra,
});

describe("abertura de atendimento externo", () => {
  it("nasce no setor do assunto e normaliza o documento", async () => {
    const { caso, gravado, auditados } = montar();
    const resultado = await caso.abrir(pedido());

    assert.match(resultado.protocolo, /^\d{6}\/2026$/);
    assert.equal(gravado.atendimentos[0]!.setorAtualId, "set-1");
    assert.equal(gravado.atendimentos[0]!.origem, "BALCAO");
    assert.equal(gravado.requerentes[0]!.documento, CPF_VALIDO, "documento não normalizado");
    assert.equal(auditados[0]!.tipoEvento, "ATENDIMENTO_ABERTO");
  });

  it("sem setor no assunto, segue a primeira etapa do fluxo", async () => {
    const { caso, gravado } = montar({
      assunto: { id: "as-1", nome: "Iluminação", setorId: null, ativo: true },
      primeiraEtapa: { setorId: "set-fluxo", departamentoId: null },
    });
    await caso.abrir(pedido());
    assert.equal(gravado.atendimentos[0]!.setorAtualId, "set-fluxo");
  });

  it("sem setor e sem fluxo, recusa em vez de criar processo sem fila", async () => {
    // Processo sem destino não aparece em tela nenhuma; ninguém descobriria
    // até o cidadão cobrar.
    const { caso, gravado } = montar({
      assunto: { id: "as-1", nome: "Iluminação", setorId: null, ativo: true },
      primeiraEtapa: null,
    });
    await recusa(() => caso.abrir(pedido()), /não tem setor responsável/);
    assert.equal(gravado.atendimentos.length, 0);
    assert.equal(gravado.requerentes.length, 0, "criou requerente numa abertura recusada");
  });

  it("recusa assunto desativado e assunto inexistente", async () => {
    const desativado = montar({
      assunto: { id: "as-1", nome: "Poço", setorId: "set-1", ativo: false },
    });
    await recusa(() => desativado.caso.abrir(pedido()), /não está atendendo este assunto/);
    assert.equal(desativado.gravado.atendimentos.length, 0);

    const { caso } = montar();
    await recusa(() => caso.abrir(pedido({ assuntoId: "outro" })), /Assunto não encontrado/);
  });

  it("documento inválido não vira cadastro", async () => {
    // Documento errado deixaria o cidadão sem conseguir acompanhar o pedido.
    const { caso, gravado } = montar();
    for (const documento of ["111.111.111-11", "529.982.247-24", "123"]) {
      await recusa(
        () => caso.abrir(pedido({
          requerente: { tipo: "CIDADAO", documento, nome: "Fulano de Tal" },
        })),
        /CPF ou CNPJ inválido/,
      );
    }
    assert.equal(gravado.requerentes.length, 0);
    assert.equal(gravado.atendimentos.length, 0);
  });

  it("exige descrição com conteúdo", async () => {
    const { caso } = montar();
    await recusa(() => caso.abrir(pedido({ descricaoPedido: "oi" })), /dez caracteres/);
  });

  it("reaproveita quem já foi atendido e atualiza o contato", async () => {
    // Dois cadastros da mesma pessoa partiriam o histórico dela em dois.
    const { caso, gravado } = montar({ requerenteExistente: { id: "req-antigo" } });
    await caso.abrir(pedido());

    assert.equal(gravado.requerentes.length, 0, "duplicou o cadastro");
    assert.equal(gravado.atendimentos[0]!.requerenteId, "req-antigo");
    assert.equal(gravado.contatos[0]!.contatoEmail, "maria@exemplo.com");
  });

  it("aceita CNPJ de outro órgão ou fornecedor", async () => {
    const { caso, gravado } = montar();
    await caso.abrir(pedido({
      requerente: { tipo: "OUTRO_ORGAO", documento: "11.222.333/0001-81", nome: "Câmara Municipal" },
    }));
    assert.equal(gravado.requerentes[0]!.documento, "11222333000181");
  });
});

describe("freio do portal do cidadão", () => {
  it("conta as aberturas do documento nas últimas 24 horas", async () => {
    const { caso, gravado } = montar({ aberturasRecentes: 4 });
    await caso.abrir(pedido({ origem: "PORTAL", usuarioId: undefined }));

    assert.equal(gravado.atendimentos.length, 1);
    assert.equal(gravado.consultasDeFreio.length, 1);
    const janela = Date.now() - gravado.consultasDeFreio[0]!.desde.getTime();
    assert.ok(janela > 23 * 3_600_000 && janela < 25 * 3_600_000, `janela de ${janela}ms`);
  });

  it("barra no teto sem gravar nada", async () => {
    const { caso, gravado } = montar({ aberturasRecentes: 5 });
    await recusa(
      () => caso.abrir(pedido({ origem: "PORTAL", usuarioId: undefined })),
      /já abriu vários pedidos hoje/,
      429,
    );
    assert.equal(gravado.atendimentos.length, 0);
  });

  it("não trava o balcão: lá há um servidor olhando quem está na frente dele", async () => {
    const { caso, gravado } = montar({ aberturasRecentes: 99 });
    await caso.abrir(pedido());

    assert.equal(gravado.atendimentos.length, 1, "o balcão foi travado pelo freio do portal");
    assert.equal(gravado.consultasDeFreio.length, 0, "o balcão consultou o freio à toa");
  });

  it("registra o pedido do portal sem atribuí-lo a um servidor", async () => {
    const { caso, auditados } = montar();
    await caso.abrir(pedido({ origem: "PORTAL", usuarioId: undefined }));

    assert.equal(auditados[0]!.usuarioId, undefined);
    assert.equal((auditados[0]!.detalhes as { origem: string }).origem, "PORTAL");
  });
});
