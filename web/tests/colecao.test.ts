import test from "node:test";
import assert from "node:assert/strict";
import { lista, pagina } from "../src/shared/api/colecao.ts";

/**
 * A fronteira entre a API e a tela.
 *
 * Cada caso aqui é uma forma de resposta que já derrubou ou derrubaria uma
 * tela. O ponto não é que a API vá mandar isso de propósito — é que o
 * `apiRequest<Page<StockReturn>>` não confere nada em tempo de execução, e
 * quando o formato muda o erro aparece três camadas adiante, dentro de um
 * `.map` no navegador, sem uma linha no log do servidor.
 */

test("lista devolve array denso e nunca explode", () => {
  assert.deepEqual(lista([1, 2]), [1, 2]);

  // O furo é o caso do bug: `[null]` fazia `lote.id` estourar no render.
  assert.deepEqual(lista([1, null, 2, undefined]), [1, 2]);

  // Nada disso é lista, e nenhum deles pode virar exceção.
  for (const nada of [null, undefined, {}, "", 0, { itens: [1] }]) {
    assert.deepEqual(lista(nada), [], `deveria virar [] : ${JSON.stringify(nada)}`);
  }
});

test("lista preserva o falso que é dado de verdade", () => {
  // Só `null` e `undefined` saem. Zero e string vazia são valores.
  assert.deepEqual(lista([0, "", false]), [0, "", false]);
});

test("pagina devolve sempre o envelope de quatro campos", () => {
  const cheia = pagina<number>({ itens: [1, 2], total: 7, pagina: 2, porPagina: 2 });
  assert.deepEqual(cheia, { itens: [1, 2], total: 7, pagina: 2, porPagina: 2 });

  // Array puro no lugar do envelope: era o que sumia com a lista na tela.
  assert.deepEqual(pagina(null), { itens: [], total: 0, pagina: 1, porPagina: 1 });
  assert.deepEqual(pagina({ itens: null }), { itens: [], total: 0, pagina: 1, porPagina: 1 });
});

test("pagina não confunde total com o tamanho da página", () => {
  // `total` é a contagem do banco; só cai para o tamanho do array quando o
  // envelope veio sem ele. Trocar um pelo outro apagaria a paginação.
  assert.equal(pagina({ itens: [1, 2], total: 90, pagina: 1, porPagina: 2 }).total, 90);
  assert.equal(pagina({ itens: [1, 2] }).total, 2);
});
