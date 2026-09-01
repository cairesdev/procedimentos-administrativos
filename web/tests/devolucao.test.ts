import test from "node:test";
import assert from "node:assert/strict";
import { opcoesDeLote } from "../src/features/stock/returns.ts";
import type { LocalStock } from "../src/features/stock/types.ts";

const produto = (lotes: unknown): LocalStock => ({
  produtoId: "p1",
  produtoNome: "Arroz tipo 1",
  unidadeMedida: "KG",
  saldo: 50,
  lotes,
} as LocalStock);

/**
 * O bug que a tela de devoluções escondia.
 *
 * O sintoma que chegou foi `Uncaught TypeError: Cannot read properties of null
 * (reading 'id')` no console do navegador, sem nada no log do servidor. A
 * causa era este mapeamento: ele lia `lote.id` de cada item da lista de lotes
 * confiando no tipo, e um furo ali derrubava o render inteiro — React descarta
 * a árvore e a página fica em branco.
 *
 * Estes casos são a lista de furos possíveis. Nenhum deles pode virar exceção:
 * o pior resultado aceitável é o seletor vir vazio, e a tela dizer que não há
 * saldo para devolver.
 */
test("um furo na lista de lotes não derruba o formulário", () => {
  assert.deepEqual(opcoesDeLote([produto([null])]), []);
  assert.deepEqual(opcoesDeLote([produto([undefined])]), []);
  assert.deepEqual(opcoesDeLote([produto(null)]), []);
  assert.deepEqual(opcoesDeLote([produto(undefined)]), []);
  assert.deepEqual(opcoesDeLote([produto([{ id: "" }])]), []);
});

test("a lista inteira fora do formato também não derruba", () => {
  for (const nada of [null, undefined, {}, "lista"]) {
    assert.deepEqual(opcoesDeLote(nada as unknown as LocalStock[]), []);
  }
  assert.deepEqual(opcoesDeLote([null as unknown as LocalStock]), []);
});

test("o lote bom sobrevive ao lado do furo", () => {
  const opcoes = opcoesDeLote([
    produto([null, { id: "l1", saldo: 12, dataValidade: "2027-01-31", dataEntrada: "2026-09-01" }]),
  ]);

  assert.equal(opcoes.length, 1);
  assert.equal(opcoes[0]?.id, "l1");
  assert.equal(opcoes[0]?.saldo, 12);
  // O rótulo é o que o servidor lê para escolher a caixa certa.
  assert.match(opcoes[0]?.rotulo ?? "", /Arroz tipo 1/);
  assert.match(opcoes[0]?.rotulo ?? "", /vence/);
});

test("lote sem validade se identifica como tal", () => {
  const opcoes = opcoesDeLote([
    produto([{ id: "l2", saldo: 3, dataValidade: null, dataEntrada: "2026-09-01" }]),
  ]);

  assert.match(opcoes[0]?.rotulo ?? "", /sem validade/);
});

test("saldo ilegível vira zero, e não NaN na tela", () => {
  const opcoes = opcoesDeLote([
    produto([{ id: "l3", saldo: null, dataValidade: null, dataEntrada: "2026-09-01" }]),
  ]);

  assert.equal(opcoes[0]?.saldo, 0);
  assert.doesNotMatch(opcoes[0]?.rotulo ?? "", /NaN/);
});
