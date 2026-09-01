import test from "node:test";
import assert from "node:assert/strict";
import { primeiraMensagem } from "../src/shared/ui/erros-do-formulario.ts";

/**
 * O botão que não fazia nada.
 *
 * `handleSubmit` do react-hook-form não chama a ação quando o schema reprova.
 * Se o campo reprovado não estiver desenhado na tela, o clique não produz nada:
 * nenhum toast, nenhuma linha no console, nenhuma requisição. Para quem está
 * usando, o sistema travou.
 *
 * Aconteceu no cadastro de modelo de checklist — o formulário declarava
 * `itens: []`, o schema exigia ao menos um, e a mensagem caía num campo que o
 * JSX não renderiza. Esta função é o que tira a mensagem de lá de dentro e a
 * põe num toast, seja qual for a profundidade em que ela esteja.
 */

test("acha a mensagem no primeiro nível", () => {
  assert.equal(
    primeiraMensagem({ nome: { message: "Informe o nome do modelo" } }),
    "Informe o nome do modelo",
  );
});

test("acha a mensagem dentro de um array de itens", () => {
  // `itens.2.titulo` — é assim que o react-hook-form representa a linha errada.
  const erros = { itens: [undefined, undefined, { titulo: { message: "Item sem título" } }] };
  assert.equal(primeiraMensagem(erros), "Item sem título");
});

test("acha a mensagem do array inteiro, e não só a de um item", () => {
  // Este era exatamente o caso do bug: a regra reprovada era a do array.
  assert.equal(
    primeiraMensagem({ itens: { message: "O modelo precisa de ao menos um item" } }),
    "O modelo precisa de ao menos um item",
  );
});

test("devolve indefinido quando não há mensagem nenhuma", () => {
  for (const nada of [undefined, null, {}, { campo: {} }, { campo: { type: "required" } }]) {
    assert.equal(primeiraMensagem(nada), undefined);
  }
});

test("ignora mensagem vazia e segue procurando", () => {
  // Um erro sem texto não pode ganhar da mensagem útil que vem depois.
  const erros = { a: { message: "" }, b: { message: "Esta serve" } };
  assert.equal(primeiraMensagem(erros), "Esta serve");
});

test("não quebra com estrutura profunda ou inesperada", () => {
  assert.equal(primeiraMensagem({ a: { b: { c: { message: "fundo" } } } }), "fundo");
  assert.equal(primeiraMensagem("texto solto"), undefined);
  assert.equal(primeiraMensagem(42), undefined);
});
