import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CumprirItem } from "../../src/application/checklist/CumprirItem";
import { GerenciarChecklist } from "../../src/application/checklist/GerenciarChecklist";
import type { ItemParaCumprir } from "../../src/application/ports/ChecklistRepository";

const recusa = async (acao: () => Promise<unknown>, mensagem: RegExp) => {
  await assert.rejects(acao, (erro: Error) => {
    assert.match(erro.message, mensagem);
    return true;
  });
};

const ITEM: ItemParaCumprir = {
  id: "item-1",
  checklistId: "ck-1",
  titulo: "Certidão negativa",
  exigeAnexo: false,
  recorrente: true,
  periodicidadeDias: 90,
  dispensadoEm: null,
  ultimoCicloId: null,
  ultimoCicloSituacao: null,
  ultimoCicloVigenciaAte: null,
  ultimoCiclo: 0,
};

const montarCumprir = (item: Partial<ItemParaCumprir> = {}) => {
  const gravado = {
    ciclos: [] as Record<string, unknown>[],
    respostas: [] as Record<string, unknown>[],
    dispensas: [] as string[],
    eventos: [] as string[],
  };

  const caso = new CumprirItem(
    {
      buscarItemParaCumprir: async () => ({ ...ITEM, ...item }),
      abrirCiclo: async (dados: Record<string, unknown>) => {
        gravado.ciclos.push(dados);
        return "ciclo-novo";
      },
      responderCiclo: async (dados: Record<string, unknown>) => {
        gravado.respostas.push(dados);
      },
      dispensarItem: async (_o: string, id: string) => { gravado.dispensas.push(id); },
      reabrirItem: async () => undefined,
    } as never,
    {
      registrar: async (evento: { tipoEvento: string }) => {
        gravado.eventos.push(evento.tipoEvento);
      },
    } as never,
    (async (fn: (tx: unknown) => unknown) => fn({})) as never,
  );

  return { caso, gravado };
};

const entrada = { orgaoId: "org-1", usuarioId: "u-1", itemId: "item-1" };

describe("cumprir um item", () => {
  it("abre o ciclo 1 e calcula a vigência", async () => {
    const { caso, gravado } = montarCumprir();
    await caso.cumprir(entrada);

    assert.equal(gravado.ciclos.length, 1);
    assert.equal(gravado.ciclos[0]!.ciclo, 1);
    // 90 dias somados à data do cumprimento — o item é recorrente.
    assert.ok(gravado.ciclos[0]!.vigenciaAte, "vigência não foi calculada");
    assert.deepEqual(gravado.eventos, ["CHECKLIST_ITEM_CUMPRIDO"]);
  });

  it("item não recorrente não ganha vigência", async () => {
    // `null` aqui quer dizer "não vence", e nunca "esqueceram de preencher":
    // quem preenche é o sistema.
    const { caso, gravado } = montarCumprir({ recorrente: false, periodicidadeDias: null });
    await caso.cumprir(entrada);
    assert.equal(gravado.ciclos[0]!.vigenciaAte, null);
  });

  it("o ciclo seguinte continua a numeração", async () => {
    const { caso, gravado } = montarCumprir({
      ultimoCiclo: 2, ultimoCicloId: "c-2", ultimoCicloSituacao: "ACEITO",
    });
    await caso.cumprir(entrada);
    assert.equal(gravado.ciclos[0]!.ciclo, 3);
  });

  it("não abre dois ciclos aguardando ao mesmo tempo", async () => {
    const { caso, gravado } = montarCumprir({
      ultimoCiclo: 1, ultimoCicloId: "c-1", ultimoCicloSituacao: "AGUARDANDO",
    });
    await recusa(() => caso.cumprir(entrada), /aguardando conferência/);
    assert.equal(gravado.ciclos.length, 0);
  });

  it("item dispensado não é cumprido", async () => {
    const { caso } = montarCumprir({ dispensadoEm: "2026-01-01" });
    await recusa(() => caso.cumprir(entrada), /dispensado/);
  });

  it("cumprir de novo o que está vigente é permitido", async () => {
    /**
     * Não é engano: é a certidão nova chegando antes de a antiga vencer. O
     * ciclo abre, e o item passa a valer pelo mais recente.
     */
    const { caso, gravado } = montarCumprir({
      ultimoCiclo: 1, ultimoCicloId: "c-1", ultimoCicloSituacao: "ACEITO",
      ultimoCicloVigenciaAte: "2030-01-01",
    });
    await caso.cumprir(entrada);
    assert.equal(gravado.ciclos.length, 1);
  });
});

describe("conferir a entrega", () => {
  const aguardando = {
    ultimoCiclo: 1, ultimoCicloId: "c-1", ultimoCicloSituacao: "AGUARDANDO" as const,
  };

  it("aceitar fecha o ciclo", async () => {
    const { caso, gravado } = montarCumprir(aguardando);
    await caso.responder({ ...entrada, aceitar: true, anexos: 0 });

    assert.equal(gravado.respostas[0]!.aceitar, true);
    assert.deepEqual(gravado.eventos, ["CHECKLIST_ITEM_ACEITO"]);
  });

  it("recusar exige motivo", async () => {
    const { caso, gravado } = montarCumprir(aguardando);
    await recusa(
      () => caso.responder({ ...entrada, aceitar: false, recusaMotivo: "x", anexos: 0 }),
      /sem motivo/,
    );
    assert.equal(gravado.respostas.length, 0);
  });

  it("recusar com motivo registra o motivo", async () => {
    const { caso, gravado } = montarCumprir(aguardando);
    await caso.responder({
      ...entrada, aceitar: false, recusaMotivo: "Certidão vencida", anexos: 0,
    });
    assert.equal(gravado.respostas[0]!.recusaMotivo, "Certidão vencida");
    assert.deepEqual(gravado.eventos, ["CHECKLIST_ITEM_RECUSADO"]);
  });

  it("item que exige anexo não é aceito sem arquivo", async () => {
    // A cobrança fica aqui, e não no cumprimento: o anexo pende do ciclo, que
    // precisa existir antes de o arquivo poder subir.
    const { caso, gravado } = montarCumprir({ ...aguardando, exigeAnexo: true });
    await recusa(
      () => caso.responder({ ...entrada, aceitar: true, anexos: 0 }),
      /exige documento anexado/,
    );
    assert.equal(gravado.respostas.length, 0);
  });

  it("com anexo, o item que o exige é aceito", async () => {
    const { caso, gravado } = montarCumprir({ ...aguardando, exigeAnexo: true });
    await caso.responder({ ...entrada, aceitar: true, anexos: 1 });
    assert.equal(gravado.respostas.length, 1);
  });

  it("recusar dispensa o anexo", async () => {
    // Recusar por falta do arquivo é justamente o caminho certo.
    const { caso, gravado } = montarCumprir({ ...aguardando, exigeAnexo: true });
    await caso.responder({
      ...entrada, aceitar: false, recusaMotivo: "Faltou a certidão", anexos: 0,
    });
    assert.equal(gravado.respostas.length, 1);
  });

  it("sem entrega aguardando, não há o que conferir", async () => {
    const { caso } = montarCumprir();
    await recusa(
      () => caso.responder({ ...entrada, aceitar: true, anexos: 0 }),
      /aguardando conferência/,
    );
  });
});

describe("dispensar", () => {
  it("exige justificativa", async () => {
    const { caso, gravado } = montarCumprir();
    await recusa(() => caso.dispensar({ ...entrada, motivo: "x" }), /Explique/);
    assert.deepEqual(gravado.dispensas, []);
  });

  it("com justificativa, dispensa e registra", async () => {
    const { caso, gravado } = montarCumprir();
    await caso.dispensar({ ...entrada, motivo: "Não se aplica a esta contratação" });
    assert.deepEqual(gravado.dispensas, ["item-1"]);
    assert.deepEqual(gravado.eventos, ["CHECKLIST_ITEM_DISPENSADO"]);
  });

  it("não dispensa duas vezes", async () => {
    const { caso } = montarCumprir({ dispensadoEm: "2026-01-01" });
    await recusa(() => caso.dispensar({ ...entrada, motivo: "de novo" }), /já está dispensado/);
  });
});

describe("montar a lista", () => {
  const montarGerenciar = (existe = true) => {
    const gravado = { criados: [] as unknown[], itens: [] as unknown[] };
    const caso = new GerenciarChecklist(
      {
        buscarModelo: async () => (existe
          ? { id: "m-1", nome: "Habilitação", descricao: null, ativo: true, totalItens: 1,
            itens: [{
              id: "mi-1", ordem: 1, titulo: "Certidão", descricao: null, exigeAnexo: true,
              prazoDias: 30, recorrente: true, periodicidadeDias: 90,
              setorId: null, departamentoId: null, paraFornecedor: true,
            }] }
          : null),
        criar: async (dados: unknown, itens: unknown[]) => {
          gravado.criados.push(dados);
          gravado.itens = itens;
          return "ck-novo";
        },
        buscar: async () => null,
      } as never,
      { registrar: async () => undefined } as never,
      (async (fn: (tx: unknown) => unknown) => fn({})) as never,
    );
    return { caso, gravado };
  };

  const base = { orgaoId: "org-1", usuarioId: "u-1" };

  it("aplicar um modelo copia os itens e vira prazo em data", async () => {
    const { caso, gravado } = montarGerenciar();
    await caso.criar({ ...base, modeloId: "m-1" });

    assert.equal(gravado.itens.length, 1);
    const item = gravado.itens[0] as { prazoLimite: string; periodicidadeDias: number };
    // No modelo o prazo é em dias; no checklist vira data, congelada.
    assert.match(item.prazoLimite, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(item.periodicidadeDias, 90);
  });

  it("sem modelo e sem itens, não há checklist", async () => {
    const { caso } = montarGerenciar();
    await recusa(() => caso.criar({ ...base, titulo: "Vazia" }), /ao menos um item/);
  });

  it("item recorrente sem periodicidade é recusado com o nome do item", async () => {
    const { caso } = montarGerenciar();
    await recusa(
      () => caso.criar({
        ...base,
        titulo: "Lista",
        itens: [{
          ordem: 1, titulo: "Certidão anual", exigeAnexo: false,
          recorrente: true, paraFornecedor: false,
        }],
      }),
      /"Certidão anual" é recorrente/,
    );
  });

  it("item com dois responsáveis é recusado", async () => {
    const { caso } = montarGerenciar();
    await recusa(
      () => caso.criar({
        ...base,
        titulo: "Lista",
        itens: [{
          ordem: 1, titulo: "Dois donos", exigeAnexo: false, recorrente: false,
          setorId: "s-1", paraFornecedor: true,
        }],
      }),
      /mais de um responsável/,
    );
  });

  it("alvo desconhecido é recusado", async () => {
    const { caso } = montarGerenciar();
    await recusa(
      () => caso.criar({ ...base, modeloId: "m-1", alvoTipo: "EMPENHO", alvoId: "x" }),
      /Tipo de alvo desconhecido/,
    );
  });
});
