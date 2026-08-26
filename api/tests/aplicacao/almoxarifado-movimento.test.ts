import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MovimentarEstoque } from "../../src/application/almoxarifado/MovimentarEstoque";
import { auditoriaFalsa, recusa, semTransacao } from "../ajudantes/dobras";

/**
 * O que acontece com o estoque depois que ele chega.
 *
 * Consumo é o único que faz o saldo da escola diminuir por uso; devolução,
 * transferência e ajuste são as três formas de o material andar sem ser
 * consumido. Cada uma existe porque a alternativa é o servidor resolver por
 * fora e o saldo ficar errado para sempre.
 */

type Cenario = {
  lotesDaUnidade?: { id: string; saldo: number; dataValidade?: string | null }[];
  loteDaUnidade?: { saldo: number; tetoDoLote: number | null; almoxarifadoId?: string } | null;
  loteDoAlmoxarifado?: { saldo: number; almoxarifadoId?: string } | null;
  devolucao?: { status: string; quantidade: number } | null;
  destinoAtivo?: boolean;
  lotacaoUnidade?: string | null;
  unidadeDoLocal?: string | null;
};

const montar = (cenario: Cenario = {}) => {
  const gravado = {
    consumos: [] as Record<string, unknown>[],
    devolucoes: [] as Record<string, unknown>[],
    respostas: [] as Record<string, unknown>[],
    transferencias: [] as Record<string, unknown>[],
    ajustes: [] as Record<string, unknown>[],
  };
  const auditoria = auditoriaFalsa();

  const almoxarifado = {
    buscarLocal: async () => ({
      id: "local-1",
      nome: "Escola Central",
      codigo: "001",
      unidadeId: cenario.unidadeDoLocal === undefined ? "un-a" : cenario.unidadeDoLocal,
      almoxarifadoId: "almox-1",
      almoxarifadoNome: "Central",
      cnpj: null,
      endereco: null,
      responsavel: null,
    }),
    buscarAlmoxarifado: async () => ({
      id: "almox-2",
      nome: "Saúde",
      ativo: cenario.destinoAtivo ?? true,
      locais: 0,
      remessas: 0,
    }),
    bloquearEstoqueLocal: async () =>
      (cenario.lotesDaUnidade ?? [{ id: "el-1", saldo: 10, dataValidade: "2027-01-01" }])
        .map((lote) => ({ ...lote, dataValidade: lote.dataValidade ?? null })),
    bloquearLoteDaUnidade: async () =>
      cenario.loteDaUnidade === null
        ? null
        : {
            id: "el-1",
            produtoId: "prod-1",
            produtoNome: "ARROZ",
            saldo: cenario.loteDaUnidade?.saldo ?? 10,
            tetoDoLote: cenario.loteDaUnidade?.tetoDoLote ?? 10,
            localId: "local-1",
            almoxarifadoId: cenario.loteDaUnidade?.almoxarifadoId ?? "almox-1",
          },
    bloquearLotePorId: async () =>
      cenario.loteDoAlmoxarifado === null
        ? null
        : {
            id: "lote-1",
            produtoId: "prod-1",
            produtoNome: "ARROZ",
            saldo: cenario.loteDoAlmoxarifado?.saldo ?? 100,
            tetoDoLote: null,
            localId: "",
            almoxarifadoId: cenario.loteDoAlmoxarifado?.almoxarifadoId ?? "almox-1",
          },
    registrarConsumo: async (dados: Record<string, unknown>) => {
      gravado.consumos.push(dados);
      return "cons-1";
    },
    criarDevolucao: async (dados: Record<string, unknown>) => {
      gravado.devolucoes.push(dados);
      return "dev-1";
    },
    bloquearDevolucao: async () =>
      cenario.devolucao === null
        ? null
        : {
            id: "dev-1",
            localNome: "Escola Central",
            almoxarifadoNome: "Central",
            produtoNome: "ARROZ",
            unidadeMedida: "KG",
            quantidade: cenario.devolucao?.quantidade ?? 5,
            status: cenario.devolucao?.status ?? "PENDENTE",
            motivo: "Sobrou",
            recusaMotivo: null,
            solicitadaPor: "Maria",
            aceitaPor: null,
            dataValidade: null,
            data: "2026-06-01",
            respondidaEm: null,
          },
    responderDevolucao: async (...args: unknown[]) => {
      gravado.respostas.push({ args });
    },
    transferirLote: async (dados: Record<string, unknown>) => {
      gravado.transferencias.push(dados);
      return { id: "tr-1", remessaDestinoId: "rem-2" };
    },
    registrarAjuste: async (dados: Record<string, unknown>) => {
      gravado.ajustes.push(dados);
      return "aj-1";
    },
  };

  const usuarios = {
    buscarPerfil: async () => ({
      nome: "Maria",
      papelBase: "SERVIDOR",
      lotacoes: cenario.lotacaoUnidade === null
        ? [{ id: "lot-1", unidadeId: null, destino: "Compras" }]
        : [{ id: "lot-1", unidadeId: cenario.lotacaoUnidade ?? "un-a", destino: "Escola" }],
    }),
  };

  return {
    gravado,
    auditados: auditoria.registros,
    movimento: new MovimentarEstoque(
      almoxarifado as never, usuarios as never, auditoria.porta as never, semTransacao as never,
    ),
  };
};

const base = { orgaoId: "org-1", usuarioId: "u-1" };

describe("consumo", () => {
  const pedido = {
    ...base,
    localId: "local-1",
    produtoId: "prod-1",
    quantidade: 6,
    forma: "ITEM_A_ITEM" as const,
  };

  it("baixa em FEFO: o que vence antes sai primeiro", async () => {
    // A cozinheira informa produto e quantidade; de qual caixa sai é conta do
    // sistema. Deixar a escolha com ela levaria à caixa da frente, que é a
    // errada.
    const { movimento, gravado } = montar({
      lotesDaUnidade: [
        { id: "novo", saldo: 10, dataValidade: "2027-01-01" },
        { id: "velho", saldo: 4, dataValidade: "2026-02-01" },
      ],
    });

    await movimento.consumir(pedido);

    assert.deepEqual(gravado.consumos[0]!.retiradas, [
      { estoqueLocalId: "velho", quantidade: 4 },
      { estoqueLocalId: "novo", quantidade: 2 },
    ]);
  });

  it("recusa consumo acima do que a unidade tem", async () => {
    const { movimento, gravado } = montar({
      lotesDaUnidade: [{ id: "el-1", saldo: 3, dataValidade: null }],
    });

    await recusa(() => movimento.consumir(pedido), /ajuste de estoque com motivo/, 422);
    assert.equal(gravado.consumos.length, 0, "gravou consumo sem saldo");
  });

  it("declaração periódica exige o período", async () => {
    const { movimento, gravado } = montar();
    await recusa(
      () => movimento.consumir({ ...pedido, forma: "DECLARACAO_PERIODICA" }),
      /precisa do período/,
    );
    assert.equal(gravado.consumos.length, 0);
  });

  it("item a item não tem período", async () => {
    // O período é do fechamento mensal; no ato, a data do ato basta.
    const { movimento, gravado } = montar();
    await recusa(
      () => movimento.consumir({ ...pedido, periodoInicio: "2026-06-01", periodoFim: "2026-06-30" }),
      /não tem período/,
    );
    assert.equal(gravado.consumos.length, 0);
  });

  it("período invertido é recusado", async () => {
    const { movimento, gravado } = montar();
    await recusa(
      () => movimento.consumir({
        ...pedido,
        forma: "DECLARACAO_PERIODICA",
        periodoInicio: "2026-06-30",
        periodoFim: "2026-06-01",
      }),
      /antes do início/,
    );
    assert.equal(gravado.consumos.length, 0);
  });

  it("quem é lotado em outra unidade não registra consumo", async () => {
    const { movimento, gravado } = montar({ lotacaoUnidade: "un-b", unidadeDoLocal: "un-a" });
    await recusa(() => movimento.consumir(pedido), /só registra movimento dela/, 403);
    assert.equal(gravado.consumos.length, 0);
  });

  it("lotado só em setor registra por qualquer local", async () => {
    const { movimento, gravado } = montar({ lotacaoUnidade: null });
    await movimento.consumir(pedido);
    assert.equal(gravado.consumos.length, 1);
  });
});

describe("devolução", () => {
  const pedido = { ...base, estoqueLocalId: "el-1", quantidade: 4, motivo: "Não vamos usar" };

  it("o saldo da escola baixa no pedido, não no aceite", async () => {
    // Enquanto espera resposta, aquele material não pode ser consumido nem
    // devolvido de novo.
    const { movimento, gravado } = montar();
    await movimento.pedirDevolucao(pedido);

    assert.equal(gravado.devolucoes.length, 1);
    assert.equal(gravado.devolucoes[0]!.quantidade, 4);
  });

  it("recusa devolver mais do que a unidade tem daquele lote", async () => {
    const { movimento, gravado } = montar({ loteDaUnidade: { saldo: 2, tetoDoLote: 10 } });
    await recusa(() => movimento.pedirDevolucao(pedido), /tem 2 deste lote/, 422);
    assert.equal(gravado.devolucoes.length, 0);
  });

  it("exige motivo com conteúdo", async () => {
    const { movimento, gravado } = montar();
    await recusa(() => movimento.pedirDevolucao({ ...pedido, motivo: "x" }), /por que o material/);
    assert.equal(gravado.devolucoes.length, 0);
  });

  it("recusa sem motivo é barrada antes de tocar no banco", async () => {
    const { movimento, gravado } = montar();
    await recusa(
      () => movimento.responderDevolucao({ ...base, devolucaoId: "dev-1", aceitar: false }),
      /sem saber o que fazer/,
    );
    assert.equal(gravado.respostas.length, 0);
  });

  it("não responde duas vezes", async () => {
    const { movimento, gravado } = montar({ devolucao: { status: "ACEITA", quantidade: 4 } });
    await recusa(
      () => movimento.responderDevolucao({ ...base, devolucaoId: "dev-1", aceitar: true }),
      /já foi aceita/,
    );
    assert.equal(gravado.respostas.length, 0);
  });

  it("aceite e recusa são eventos diferentes na auditoria", async () => {
    const aceite = montar();
    await aceite.movimento.responderDevolucao({ ...base, devolucaoId: "dev-1", aceitar: true });
    assert.equal(aceite.auditados[0]!.tipoEvento, "DEVOLUCAO_ESTOQUE_ACEITA");

    const recusado = montar();
    await recusado.movimento.responderDevolucao({
      ...base, devolucaoId: "dev-1", aceitar: false, motivoRecusa: "Embalagem violada",
    });
    assert.equal(recusado.auditados[0]!.tipoEvento, "DEVOLUCAO_ESTOQUE_RECUSADA");
  });
});

describe("transferência entre almoxarifados", () => {
  const pedido = {
    ...base,
    loteId: "lote-1",
    almoxarifadoDestinoId: "almox-2",
    quantidade: 30,
  };

  it("debita a origem e cria a remessa no destino", async () => {
    const { movimento, gravado } = montar();
    const resultado = await movimento.transferir(pedido);

    assert.equal(resultado.remessaDestinoId, "rem-2");
    assert.equal(gravado.transferencias[0]!.quantidade, 30);
  });

  it("recusa transferir para o próprio almoxarifado", async () => {
    const { movimento, gravado } = montar({
      loteDoAlmoxarifado: { saldo: 100, almoxarifadoId: "almox-2" },
    });
    await recusa(() => movimento.transferir(pedido), /mesmo almoxarifado/);
    assert.equal(gravado.transferencias.length, 0);
  });

  it("recusa quantidade acima do saldo do lote", async () => {
    const { movimento, gravado } = montar({ loteDoAlmoxarifado: { saldo: 5 } });
    await recusa(() => movimento.transferir(pedido), /tem 5 e a transferência/, 422);
    assert.equal(gravado.transferencias.length, 0);
  });

  it("recusa destino inativo", async () => {
    // Mandar material para almoxarifado desativado o esconderia de todas as
    // telas — o saldo existiria e ninguém acharia.
    const { movimento, gravado } = montar({ destinoAtivo: false });
    await recusa(() => movimento.transferir(pedido), /está inativo/);
    assert.equal(gravado.transferencias.length, 0);
  });
});

describe("ajuste de estoque", () => {
  const noAlmoxarifado = {
    ...base, loteId: "lote-1", saldoCorrigido: 90, motivo: "CONTAGEM" as const,
  };

  it("grava o saldo contado, não a diferença", async () => {
    // É uma contagem física substituindo o que o sistema achava que tinha.
    const { movimento, gravado } = montar({ loteDoAlmoxarifado: { saldo: 100 } });
    const { saldoAnterior } = await movimento.ajustar(noAlmoxarifado);

    assert.equal(saldoAnterior, 100);
    assert.equal(gravado.ajustes[0]!.saldoCorrigido, 90);
    assert.equal(gravado.ajustes[0]!.saldoAnterior, 100);
  });

  it("exige um lado ou o outro, nunca os dois", async () => {
    const { movimento, gravado } = montar();
    await recusa(
      () => movimento.ajustar({ ...noAlmoxarifado, estoqueLocalId: "el-1" }),
      /um dos dois, nunca os dois/,
    );
    await recusa(
      () => movimento.ajustar({ ...base, saldoCorrigido: 5, motivo: "CONTAGEM" }),
      /um dos dois, nunca os dois/,
    );
    assert.equal(gravado.ajustes.length, 0);
  });

  it("ajuste que não muda nada é recusado", async () => {
    const { movimento, gravado } = montar({ loteDoAlmoxarifado: { saldo: 90 } });
    await recusa(() => movimento.ajustar(noAlmoxarifado), /igual ao que já está/);
    assert.equal(gravado.ajustes.length, 0);
  });

  it("na unidade, não passa do que ela recebeu", async () => {
    // Material a mais entrou por outro caminho, e o caminho precisa ser
    // registrado — não escondido num ajuste.
    const { movimento, gravado } = montar({ loteDaUnidade: { saldo: 5, tetoDoLote: 7 } });
    await recusa(
      () => movimento.ajustar({
        ...base, estoqueLocalId: "el-1", saldoCorrigido: 20, motivo: "SOBRA",
      }),
      /precisa entrar como remessa/,
      422,
    );
    assert.equal(gravado.ajustes.length, 0);
  });

  it("contagem que acha material a mais, dentro do recebido, é aceita", async () => {
    const { movimento, gravado } = montar({ loteDaUnidade: { saldo: 5, tetoDoLote: 7 } });
    await movimento.ajustar({
      ...base, estoqueLocalId: "el-1", saldoCorrigido: 7, motivo: "SOBRA",
    });
    assert.equal(gravado.ajustes[0]!.saldoCorrigido, 7);
    assert.equal(gravado.ajustes[0]!.loteId, null);
  });

  it("saldo negativo é recusado", async () => {
    const { movimento, gravado } = montar();
    await recusa(
      () => movimento.ajustar({ ...noAlmoxarifado, saldoCorrigido: -1 }),
      /não pode ser negativo/,
    );
    assert.equal(gravado.ajustes.length, 0);
  });

  it("a auditoria registra a diferença, não só o novo saldo", async () => {
    // Quem lê a trilha quer saber quanto sumiu, e não ter de subtrair.
    const { movimento, auditados } = montar({ loteDoAlmoxarifado: { saldo: 100 } });
    await movimento.ajustar({ ...noAlmoxarifado, motivo: "PERDA" });

    const evento = auditados.find((e) => e.tipoEvento === "AJUSTE_ESTOQUE_REGISTRADO");
    assert.equal((evento!.detalhes as { diferenca: number }).diferenca, -10);
    assert.equal((evento!.detalhes as { onde: string }).onde, "almoxarifado");
  });
});
