import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filaDeEmailFalsa, semTransacao } from "../ajudantes/dobras";
import { EnfileirarEmail } from "../../src/application/email/EnfileirarEmail";
import { ExigirDoRequerente } from "../../src/application/protocolo/ExigirDoRequerente";
import { CPF_VALIDO, auditoriaFalsa, recusa } from "../ajudantes/dobras";

const PROTOCOLO = "000001/2026";

type Exigencia = Record<string, unknown> & { id: string; status: string };

const montar = (opcoes: { status?: string; exigencias?: Exigencia[] } = {}) => {
  const gravado = {
    exigencias: opcoes.exigencias ?? ([] as Exigencia[]),
    respondidas: [] as { id: string; texto: string }[],
    canceladas: [] as { id: string; motivo: string }[],
    anexos: [] as Record<string, unknown>[],
    objetos: new Map<string, Buffer>(),
  };
  const auditoria = auditoriaFalsa();

  const protocolo = {
    // A exigência agora lê o atendimento para saber a quem avisar.
    buscarAtendimento: async () => ({
      numeroProtocolo: "PROT-2026-0001",
      requerenteNome: "José da Silva",
      requerenteEmail: "jose@exemplo.com",
    }),
    processoDoRequerente: async (numero: string, documento: string) =>
      (numero === PROTOCOLO && documento === CPF_VALIDO
        ? {
            processoId: "proc-1", orgaoId: "org-1", requerenteId: "req-1",
            status: opcoes.status ?? "TRAMITANDO",
          }
        : null),
    listarExigencias: async () => gravado.exigencias,
    exigenciasDoRequerente: async () => gravado.exigencias,
    buscarExigencia: async (id: string) =>
      gravado.exigencias.find((exigencia) => exigencia.id === id) ?? null,
    criarExigencia: async (dados: Record<string, unknown>, prazoLimite: string | null) => {
      const id = `ex-${gravado.exigencias.length + 1}`;
      gravado.exigencias.push({ id, status: "PENDENTE", prazoLimite, ...dados });
      return id;
    },
    responderExigencia: async (id: string, texto: string) => {
      gravado.respondidas.push({ id, texto });
    },
    cancelarExigencia: async (_orgao: string, id: string, motivo: string) => {
      gravado.canceladas.push({ id, motivo });
      const alvo = gravado.exigencias.find((exigencia) => exigencia.id === id);
      if (alvo) alvo.status = "CANCELADA";
    },
  };
  const anexos = {
    criar: async (dados: Record<string, unknown>) => {
      gravado.anexos.push(dados);
      return `anx-${gravado.anexos.length}`;
    },
  };
  const armazenamento = {
    salvar: async (caminho: string, conteudo: Buffer) => {
      gravado.objetos.set(caminho, conteudo);
    },
    remover: async (caminho: string) => {
      gravado.objetos.delete(caminho);
    },
  };

  return {
    gravado,
    auditados: auditoria.registros,
    caso: new ExigirDoRequerente(
      protocolo as never, anexos as never, armazenamento as never, auditoria.porta as never,
      semTransacao, new EnfileirarEmail(filaDeEmailFalsa().porta as never),
      "https://exemplo.gov.br",
    ),
  };
};

const pdf = (bytes = 100) => Buffer.alloc(bytes, 1);

describe("o setor exige", () => {
  it("congela o prazo na criação", async () => {
    // Mudar o padrão do assunto depois não pode encurtar retroativamente o
    // prazo de quem já foi notificado.
    const { caso, gravado, auditados } = montar();
    await caso.exigir({
      orgaoId: "org-1", processoId: "proc-1", usuarioId: "u-1",
      texto: "Junte o comprovante de residência atualizado.", prazoDias: 10,
    });

    const criada = gravado.exigencias[0]!;
    assert.equal(criada.status, "PENDENTE");
    const limite = new Date(`${String(criada.prazoLimite)}T12:00:00Z`).getTime();
    const dias = Math.round((limite - Date.now()) / 86_400_000);
    assert.ok(dias >= 9 && dias <= 10, `prazo de ${dias} dias`);
    assert.equal(auditados[0]!.tipoEvento, "EXIGENCIA_REGISTRADA");
  });

  it("recusa uma segunda exigência em aberto", async () => {
    // Duas perguntas pendentes deixam o requerente sem saber a qual responde.
    const { caso, gravado } = montar({ exigencias: [{ id: "ex-0", status: "PENDENTE" }] });
    await recusa(
      () => caso.exigir({
        orgaoId: "org-1", processoId: "proc-1", usuarioId: "u-1",
        texto: "Outra coisa qualquer que falta.",
      }),
      /Já existe uma exigência aguardando/,
    );
    assert.equal(gravado.exigencias.length, 1);
  });

  it("exige texto com conteúdo", async () => {
    const { caso } = montar();
    await recusa(
      () => caso.exigir({ orgaoId: "org-1", processoId: "proc-1", usuarioId: "u-1", texto: "manda" }),
      /dez caracteres/,
    );
  });

  it("cancela só o que está pendente, e com motivo", async () => {
    const { caso, gravado } = montar({
      exigencias: [{ id: "ex-1", processoId: "proc-1", status: "PENDENTE" }],
    });
    await caso.cancelarExigencia({
      orgaoId: "org-1", usuarioId: "u-1", exigenciaId: "ex-1", motivo: "resolvido por telefone",
    });
    assert.equal(gravado.canceladas[0]!.id, "ex-1");

    await recusa(
      () => caso.cancelarExigencia({
        orgaoId: "org-1", usuarioId: "u-1", exigenciaId: "ex-1", motivo: "de novo",
      }),
      /Só exigência pendente/,
    );
  });
});

describe("o requerente responde, sem sessão", () => {
  it("registra a resposta sem atribuí-la a um servidor", async () => {
    const { caso, gravado, auditados } = montar({
      exigencias: [{ id: "ex-1", status: "PENDENTE" }],
    });
    await caso.responder({
      numeroProtocolo: PROTOCOLO, documento: "529.982.247-25", texto: "Segue anexo.",
    });

    assert.deepEqual(gravado.respondidas, [{ id: "ex-1", texto: "Segue anexo." }]);
    assert.equal(auditados.at(-1)!.tipoEvento, "EXIGENCIA_RESPONDIDA");
    assert.equal(auditados.at(-1)!.usuarioId, undefined, "resposta do cidadão virou ato de servidor");
  });

  it("dá a mesma resposta para par errado e protocolo inexistente", async () => {
    // Distinguir os dois diria a quem varre qual protocolo existe.
    const { caso, gravado } = montar({ exigencias: [{ id: "ex-1", status: "PENDENTE" }] });
    for (const [numero, documento] of [
      [PROTOCOLO, "11144477735"],
      ["999999/2026", CPF_VALIDO],
    ] as const) {
      await recusa(
        () => caso.responder({ numeroProtocolo: numero, documento, texto: "tentativa" }),
        /Não encontramos protocolo com esse número/,
      );
    }
    assert.equal(gravado.respondidas.length, 0);
  });

  it("não responde onde não há pergunta", async () => {
    const { caso } = montar({ exigencias: [{ id: "ex-1", status: "RESPONDIDA" }] });
    await recusa(
      () => caso.responder({ numeroProtocolo: PROTOCOLO, documento: CPF_VALIDO, texto: "de novo" }),
      /Não há exigência aguardando/,
    );
  });

  it("protocolo concluído não recebe mais nada", async () => {
    // Documento enviado a processo encerrado ficaria nos autos sem ninguém
    // para ler, e o cidadão acharia que juntou.
    for (const status of ["ENCERRADO", "CANCELADO"]) {
      const { caso, gravado } = montar({ status, exigencias: [{ id: "ex-1", status: "PENDENTE" }] });

      await recusa(
        () => caso.responder({ numeroProtocolo: PROTOCOLO, documento: CPF_VALIDO, texto: "tarde" }),
        /já foi concluído/,
      );
      await recusa(
        () => caso.anexar({
          numeroProtocolo: PROTOCOLO, documento: CPF_VALIDO,
          nomeOriginal: "a.pdf", conteudo: pdf(), mimeType: "application/pdf",
        }),
        /já foi concluído/,
      );

      assert.equal(gravado.anexos.length, 0);
      assert.equal(gravado.objetos.size, 0, "gravou arquivo de protocolo encerrado");
    }
  });
});

describe("anexo do requerente", () => {
  it("guarda o arquivo e o liga à exigência", async () => {
    const { caso, gravado, auditados } = montar({
      exigencias: [{ id: "ex-1", status: "PENDENTE" }],
    });
    await caso.anexar({
      numeroProtocolo: PROTOCOLO, documento: CPF_VALIDO, exigenciaId: "ex-1",
      nomeOriginal: "Comprovante de residência.pdf",
      conteudo: pdf(), mimeType: "application/pdf",
    });

    const anexo = gravado.anexos[0]!;
    assert.equal(anexo.exigenciaId, "ex-1");
    assert.equal(anexo.enviadoPorRequerenteId, "req-1");
    assert.equal(anexo.enviadoPorUsuarioId, undefined, "anexo do cidadão saiu como de servidor");
    assert.ok(String(anexo.arquivo).startsWith("org-1/processos/proc-1/"), String(anexo.arquivo));
    assert.ok(!/[ãç ]/.test(String(anexo.arquivo)), "nome de arquivo não sanitizado");
    assert.equal(gravado.objetos.size, 1);
    assert.equal((auditados.at(-1)!.detalhes as { origem: string }).origem, "REQUERENTE");
  });

  it("recusa tipo e tamanho sem deixar lixo no storage", async () => {
    const { caso, gravado } = montar();
    await recusa(
      () => caso.anexar({
        numeroProtocolo: PROTOCOLO, documento: CPF_VALIDO,
        nomeOriginal: "virus.exe", conteudo: pdf(), mimeType: "application/x-msdownload",
      }),
      /PDF, PNG, JPEG ou WEBP/,
    );
    await recusa(
      () => caso.anexar({
        numeroProtocolo: PROTOCOLO, documento: CPF_VALIDO,
        nomeOriginal: "grande.pdf", conteudo: pdf(10 * 1024 * 1024 + 1),
        mimeType: "application/pdf",
      }),
      /10 MB/,
    );

    assert.equal(gravado.objetos.size, 0);
    assert.equal(gravado.anexos.length, 0);
  });
});
