import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checklistCompleto, estaAtrasado, situacaoDoItem, vigenciaAte,
  type ItemParaSituacao,
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
