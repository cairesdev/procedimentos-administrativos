import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idDoCriado } from "../src/shared/api/id-do-criado.ts";

describe("o id do registro criado", () => {
  it("vem do que a operação devolveu", () => {
    assert.equal(idDoCriado({ id: "abc-123" }), "abc-123");
  });

  it("operação que não devolve nada não tem id", () => {
    // É a maioria: editar, excluir, aceitar. Nenhuma cria registro novo.
    assert.equal(idDoCriado(undefined), undefined);
    assert.equal(idDoCriado(null), undefined);
    assert.equal(idDoCriado("ok"), undefined);
    assert.equal(idDoCriado({ mensagem: "pronto" }), undefined);
  });

  it("id que não é texto útil não vira rota", () => {
    /**
     * `/processos/relatorios/undefined` é pior que uma mensagem de erro: a
     * pessoa clica, a tela troca, e o 404 aparece sem explicar o que houve.
     */
    assert.equal(idDoCriado({ id: 42 }), undefined);
    assert.equal(idDoCriado({ id: null }), undefined);
    assert.equal(idDoCriado({ id: "" }), undefined);
    assert.equal(idDoCriado({ id: "   " }), undefined);
  });
});
