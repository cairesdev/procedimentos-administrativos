import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const WEB = path.join(__dirname, "..", "..", "..", "web", "src");
const ler = (...partes: string[]) => readFileSync(path.join(WEB, ...partes), "utf8");

describe("o id do registro criado chega à tela", () => {
  it("runAction usa o retorno da operação, e não o descarta", () => {
    /**
     * `await operation();` sozinho perdia o retorno. Quem precisava do id
     * guardava-o numa variável fora da closure — e esquecer disso não quebra
     * nada visível: o `resultado.id` sai `undefined` e a tela acusa a API de
     * não ter devolvido o que devolveu. Foi o que aconteceu com "Emitir
     * relatório".
     */
    const acao = ler("shared", "api", "action-result.ts");

    assert.match(
      acao, /idDoCriado\(await operation\(\)\)/,
      "runAction voltou a descartar o retorno da operação",
    );
    assert.doesNotMatch(
      acao, /^\s*await operation\(\);\s*$/m,
      "sobrou um `await operation();` que joga fora o id",
    );
  });

  it("a ação do relatório devolve o que a API criou", () => {
    const relatorios = ler("features", "reports", "actions.ts");
    assert.match(relatorios, /return criado;/, "saveReportCut parou de devolver o criado");
  });
});

/**
 * Sem os comentários.
 *
 * A primeira versão deste teste procurava `min-width: 0` no arquivo inteiro, e
 * o comentário logo acima da regra explicava por que ela existe — citando-a.
 * Apagar a regra deixava o teste verde. Regra é o que o navegador lê.
 */
const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("os filtros cabem na tela", () => {
  it("a barra de ferramentas quebra linha", () => {
    /**
     * Seis controles numa linha só empurravam a página para a direita. A
     * rolagem horizontal não é vista por quem usa: o botão "Aplicar" some do
     * campo de visão e a tela parece incompleta.
     */
    const layout = semComentarios(readFileSync(
      path.join(WEB, "shared", "ui", "layout.module.css"), "utf8"));
    const barra = layout.slice(layout.indexOf(".toolbar {"),
      layout.indexOf("}", layout.indexOf(".toolbar {")));

    assert.match(barra, /flex-wrap:\s*wrap/, "a .toolbar voltou a ser uma linha rígida");
  });

  it("o seletor de fornecedor tem teto de largura", () => {
    /**
     * `select` se dimensiona pela opção mais larga, e razão social de empresa
     * é longa: um campo passava de 500px sozinho. O `min-width: 0` é o que
     * permite encolher — em flex, o mínimo de um item é o do seu conteúdo, e
     * sem ele o `max-width` não é obedecido.
     */
    const filtros = semComentarios(readFileSync(
      path.join(WEB, "features", "reports", "components", "ReportFilterBar.module.css"),
      "utf8"));

    assert.match(filtros, /max-width:\s*\d+px/, "sumiu o teto de largura do seletor");
    assert.match(filtros, /min-width:\s*0/, "sem min-width: 0, o max-width não vale em flex");
  });
});
