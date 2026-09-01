import test from "node:test";
import assert from "node:assert/strict";
import { agruparPorCategoria, categoriasUsadas } from "../src/shared/lib/categorias.ts";

const item = (produto: string, categoria?: string | null) => ({ produto, categoria });

test("separa os itens pelas categorias, em ordem alfabética", () => {
  const grupos = agruparPorCategoria([
    item("Seringa", "Saúde"),
    item("Caderno", "Educação"),
    item("Gaze", "Saúde"),
  ]);

  assert.deepEqual(grupos.map((g) => g.categoria), ["Educação", "Saúde"]);
  assert.deepEqual(grupos[1]?.itens.map((i) => i.produto), ["Seringa", "Gaze"]);
});

test("categoria vazia, em branco ou ausente é o mesmo bloco", () => {
  // São o mesmo "sem categoria" para quem lê a tela; blocos separados seriam
  // ruído sobre um detalhe de digitação.
  const grupos = agruparPorCategoria([
    item("A", ""),
    item("B", "   "),
    item("C", null),
    item("D"),
  ]);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0]?.categoria, null);
  assert.deepEqual(grupos[0]?.itens.map((i) => i.produto), ["A", "B", "C", "D"]);
});

test("o bloco sem categoria fica por último", () => {
  // É o resto — e resto no meio da tela quebra a leitura das seções nomeadas.
  const grupos = agruparPorCategoria([
    item("Avulso", null),
    item("Caderno", "Educação"),
    item("Zíper", "Zeladoria"),
  ]);

  assert.deepEqual(grupos.map((g) => g.categoria), ["Educação", "Zeladoria", null]);
});

test("espaço em volta não cria categoria nova", () => {
  const grupos = agruparPorCategoria([item("A", "Saúde"), item("B", "  Saúde  ")]);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0]?.itens.length, 2);
});

test("ordena com acento como se espera em português", () => {
  // Sem `localeCompare` em pt-BR, "Água" cairia depois de "Zeladoria".
  const grupos = agruparPorCategoria([item("A", "Zeladoria"), item("B", "Água")]);

  assert.deepEqual(grupos.map((g) => g.categoria), ["Água", "Zeladoria"]);
});

test("lista fora do formato não derruba a tela", () => {
  for (const nada of [null, undefined, {}, "itens"]) {
    assert.deepEqual(agruparPorCategoria(nada as never), []);
  }
  assert.deepEqual(agruparPorCategoria([null as never]), []);
});

test("as categorias usadas saem sem repetição, para sugerir enquanto digita", () => {
  assert.deepEqual(
    categoriasUsadas([item("A", "Saúde"), item("B", "Educação"), item("C", " Saúde "), item("D")]),
    ["Educação", "Saúde"],
  );
});
