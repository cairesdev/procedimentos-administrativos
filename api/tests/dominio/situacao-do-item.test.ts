import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checklistCompleto, estaAtrasado, pendenciasPorPeso, resumoDePendencias,
  situacaoDoItem, vigenciaAte, type ItemParaSituacao,
} from "../../src/domain/checklist/SituacaoDoItem";

const HOJE = "2026-06-30";
const item = (partes: Partial<ItemParaSituacao> = {}): ItemParaSituacao => ({
  dispensadoEm: null,
  prazoLimite: null,
  ultimoCiclo: null,
  ...partes,
});

describe("a situação do item vem do último ciclo", () => {
  it("sem ciclo nenhum, está pendente", () => {
    assert.equal(situacaoDoItem(item(), HOJE), "PENDENTE");
  });

  it("entregue e não conferido, aguarda conferência", () => {
    assert.equal(
      situacaoDoItem(item({ ultimoCiclo: { situacao: "AGUARDANDO", vigenciaAte: null } }), HOJE),
      "AGUARDANDO_CONFERENCIA",
    );
  });

  it("recusado volta a pendente", () => {
    // A recusa é resposta ao que foi entregue, não o fim da linha.
    assert.equal(
      situacaoDoItem(item({ ultimoCiclo: { situacao: "RECUSADO", vigenciaAte: null } }), HOJE),
      "PENDENTE",
    );
  });

  it("aceito sem vigência fica cumprido para sempre", () => {
    assert.equal(
      situacaoDoItem(item({ ultimoCiclo: { situacao: "ACEITO", vigenciaAte: null } }), HOJE),
      "CUMPRIDO",
    );
  });

  it("aceito e dentro da vigência está cumprido", () => {
    assert.equal(
      situacaoDoItem(
        item({ ultimoCiclo: { situacao: "ACEITO", vigenciaAte: "2026-09-28" } }), HOJE),
      "CUMPRIDO",
    );
  });

  it("o último dia da vigência ainda vale", () => {
    /**
     * Certidão que vale "até 30/06" vale **no** dia 30. Vencer um dia antes
     * do documento apareceria justamente em quem entrega no último dia.
     */
    assert.equal(
      situacaoDoItem(item({ ultimoCiclo: { situacao: "ACEITO", vigenciaAte: HOJE } }), HOJE),
      "CUMPRIDO",
    );
  });

  it("no dia seguinte, venceu", () => {
    assert.equal(
      situacaoDoItem(
        item({ ultimoCiclo: { situacao: "ACEITO", vigenciaAte: "2026-06-29" } }), HOJE),
      "VENCIDO",
    );
  });

  it("dispensado vence qualquer outra coisa", () => {
    // Inclusive um ciclo aceito: dispensar é dizer que o item deixou de ser
    // exigível, e isso não depende do que foi entregue antes.
    assert.equal(
      situacaoDoItem(
        item({
          dispensadoEm: "2026-01-01",
          ultimoCiclo: { situacao: "ACEITO", vigenciaAte: "2020-01-01" },
        }),
        HOJE,
      ),
      "DISPENSADO",
    );
  });
});

describe("o checklist está completo hoje", () => {
  it("todos cumpridos", () => {
    assert.equal(checklistCompleto(["CUMPRIDO", "CUMPRIDO", "DISPENSADO"]), true);
  });

  it("um vencido derruba", () => {
    // É o ponto do item recorrente: o checklist completo volta a incompleto
    // sozinho, sem ninguém mexer nele.
    assert.equal(checklistCompleto(["CUMPRIDO", "VENCIDO"]), false);
  });

  it("um em conferência também derruba", () => {
    assert.equal(checklistCompleto(["CUMPRIDO", "AGUARDANDO_CONFERENCIA"]), false);
  });

  it("checklist sem item nenhum não está completo", () => {
    // Lista vazia é lista que ninguém montou, e não lista cumprida.
    assert.equal(checklistCompleto([]), false);
  });
});

describe("atraso é do prazo, não da vigência", () => {
  it("pendente com prazo passado está atrasado", () => {
    const alvo = item({ prazoLimite: "2026-06-01" });
    assert.equal(estaAtrasado(alvo, "PENDENTE", HOJE), true);
  });

  it("cumprido não está atrasado, mesmo com prazo passado", () => {
    const alvo = item({ prazoLimite: "2026-06-01" });
    assert.equal(estaAtrasado(alvo, "CUMPRIDO", HOJE), false);
  });

  it("no dia do prazo ainda não está atrasado", () => {
    assert.equal(estaAtrasado(item({ prazoLimite: HOJE }), "PENDENTE", HOJE), false);
  });

  it("sem prazo, nunca atrasa", () => {
    assert.equal(estaAtrasado(item(), "PENDENTE", HOJE), false);
  });
});

describe("a vigência é calculada", () => {
  it("soma a periodicidade à data do cumprimento", () => {
    assert.equal(vigenciaAte("2026-06-30", 90), "2026-09-28");
  });

  it("atravessa a virada do ano", () => {
    assert.equal(vigenciaAte("2026-12-20", 30), "2027-01-19");
  });

  it("item não recorrente não vence", () => {
    assert.equal(vigenciaAte("2026-06-30", null), null);
  });

  it("aceita o carimbo de tempo completo", () => {
    // O cumprimento é TIMESTAMPTZ; a vigência é DATE. Só a data importa.
    assert.equal(vigenciaAte("2026-06-30T23:45:00.000Z", 1), "2026-07-01");
  });
});

describe("o que falta, por peso", () => {
  const pendente = (classificacao: string | null) => ({
    dispensadoEm: null,
    prazoLimite: null,
    ultimoCiclo: null,
    classificacao: classificacao as never,
  });

  const cumprido = (classificacao: string | null) => ({
    ...pendente(classificacao),
    ultimoCiclo: { situacao: "ACEITO" as const, vigenciaAte: null },
  });

  it("separa por classificação", () => {
    const contagem = pendenciasPorPeso([
      pendente("OBRIGATORIA"), pendente("OBRIGATORIA"), pendente("OBRIGATORIA"),
      pendente("ESSENCIAL"),
      cumprido("OBRIGATORIA"),
    ], HOJE);

    assert.equal(contagem.OBRIGATORIA, 3);
    assert.equal(contagem.ESSENCIAL, 1);
    assert.equal(contagem.total, 4);
  });

  it("item sem classificação cai em SEM_PESO", () => {
    // Checklist comum não é do PNTP, e inventar um peso para ele diria algo
    // que ninguém afirmou.
    const contagem = pendenciasPorPeso([pendente(null), pendente(null)], HOJE);
    assert.equal(contagem.SEM_PESO, 2);
    assert.equal(contagem.OBRIGATORIA, 0);
  });

  it("vencido conta como pendência", () => {
    const contagem = pendenciasPorPeso([{
      dispensadoEm: null, prazoLimite: null,
      ultimoCiclo: { situacao: "ACEITO", vigenciaAte: "2026-01-01" },
      classificacao: "OBRIGATORIA" as never,
    }], HOJE);
    assert.equal(contagem.OBRIGATORIA, 1);
  });

  it("aguardando conferência não conta", () => {
    /**
     * Já saiu das mãos de quem cumpre: cobrá-lo de novo seria cobrar duas
     * vezes a mesma entrega.
     */
    const contagem = pendenciasPorPeso([{
      dispensadoEm: null, prazoLimite: null,
      ultimoCiclo: { situacao: "AGUARDANDO", vigenciaAte: null },
      classificacao: "OBRIGATORIA" as never,
    }], HOJE);
    assert.equal(contagem.total, 0);
  });

  it("dispensado não conta", () => {
    const contagem = pendenciasPorPeso([{
      dispensadoEm: "2026-01-01", prazoLimite: null, ultimoCiclo: null,
      classificacao: "OBRIGATORIA" as never,
    }], HOJE);
    assert.equal(contagem.total, 0);
  });
});

describe("a frase que a tela mostra", () => {
  const contar = (partes: Partial<ReturnType<typeof pendenciasPorPeso>>) => ({
    OBRIGATORIA: 0, ESSENCIAL: 0, RECOMENDADA: 0, SEM_PESO: 0, total: 0, ...partes,
  });

  it("nada pendente", () => {
    assert.equal(resumoDePendencias(contar({})), "sem pendências");
  });

  it("uma só, no singular", () => {
    assert.equal(
      resumoDePendencias(contar({ OBRIGATORIA: 1, total: 1 })),
      "1 obrigatória",
    );
  });

  it("várias, no plural", () => {
    assert.equal(
      resumoDePendencias(contar({ OBRIGATORIA: 3, total: 3 })),
      "3 obrigatórias",
    );
  });

  it("duas categorias ligadas por 'e'", () => {
    assert.equal(
      resumoDePendencias(contar({ OBRIGATORIA: 3, ESSENCIAL: 1, total: 4 })),
      "3 obrigatórias e 1 essencial",
    );
  });

  it("três categorias: vírgula até o penúltimo", () => {
    assert.equal(
      resumoDePendencias(contar({ OBRIGATORIA: 3, ESSENCIAL: 1, RECOMENDADA: 2, total: 6 })),
      "3 obrigatórias, 1 essencial e 2 recomendadas",
    );
  });

  it("checklist comum fala de itens, não de obrigatórias", () => {
    assert.equal(resumoDePendencias(contar({ SEM_PESO: 2, total: 2 })), "2 itens");
  });
});
