import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { Request } from "express";
import { filtroDaQuery } from "../../src/interface/http/queryParam";

/**
 * Filtro em branco não vira valor.
 *
 * O `<select>` de "Todos os locais" tem `value=""`, e clicar em Filtrar manda
 * `?local=`. Cada rota escrevia à mão `typeof req.query.x === "string"`, que
 * devolve `""` para um campo presente e vazio — e o `""` seguia até o SQL como
 * `$n::uuid`. Quatro telas do almoxarifado respondiam "Erro interno" ao filtrar
 * sem escolher nada, e patrimônio e contratos tinham o mesmo campo pelo mesmo
 * caminho.
 */

const rotas = path.join(__dirname, "..", "..", "src", "interface", "http", "routes");

const comoRequisicao = (query: Record<string, unknown>) => ({ query }) as unknown as Request;

describe("filtro em branco é o mesmo que filtro ausente", () => {
  it("vazio vira undefined", () => {
    assert.equal(filtroDaQuery(comoRequisicao({ local: "" }), "local"), undefined);
  });

  it("só espaços também", () => {
    // O usuário não digitou isto; veio de um campo de texto que ficou com um
    // espaço, e `" "::uuid` estoura igual.
    assert.equal(filtroDaQuery(comoRequisicao({ local: "   " }), "local"), undefined);
  });

  it("ausente continua undefined", () => {
    assert.equal(filtroDaQuery(comoRequisicao({}), "local"), undefined);
  });

  it("valor de verdade passa, aparado", () => {
    assert.equal(filtroDaQuery(comoRequisicao({ local: " abc " }), "local"), "abc");
  });

  it("array de repetição não vira string", () => {
    // `?local=a&local=b` chega como array. Não é filtro válido, e virar
    // `"a,b"` daria um uuid inventado.
    assert.equal(filtroDaQuery(comoRequisicao({ local: ["a", "b"] }), "local"), undefined);
  });

  it("nenhuma rota lê a query à mão", () => {
    /**
     * A correção só vale enquanto for o único caminho. O padrão inline é o
     * que espalhou o furo por cinco arquivos, e reescrevê-lo numa rota nova
     * traria o mesmo "Erro interno" de volta — sem que teste nenhum notasse.
     */
    const inline = /typeof req\.query[.[]/;
    const reincidentes = readdirSync(rotas)
      .filter((arquivo) => inline.test(readFileSync(path.join(rotas, arquivo), "utf8")));

    assert.deepEqual(
      reincidentes, [],
      `estes arquivos leem req.query à mão em vez de usar filtroDaQuery: ${reincidentes}`,
    );
  });
});
