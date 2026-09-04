import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { limparCorpo } from "../../src/domain/documento/CorpoSeguro";

/**
 * O sanitizador tem de tirar o perigoso **e deixar o resto passar**.
 *
 * O segundo lado não era conferido, e cobrou caro: a lista de estilos exigia
 * unidade em todo valor, então `margin: 0 0 18px` — CSS válido, e como se
 * escreve espaçamento — era descartado inteiro. A capa do processo foi
 * desenhada com esses zeros e saiu sem espaçamento nenhum. Nada avisava:
 * `tagsRemovidas` só olha tag, e o corpo continuava "válido".
 */

const MIGRATIONS = path.join(__dirname, "..", "..", "db", "migrations");

/** Cada declaração `propriedade:valor`, com o espaço normalizado. */
const declaracoes = (html: string): string[] =>
  [...html.matchAll(/style="([^"]*)"/g)]
    .flatMap((achado) => achado[1]!.split(";"))
    .map((declaracao) => declaracao.trim().replace(/\s*:\s*/, ":").replace(/\s+/g, " "))
    .filter(Boolean);

describe("o corpo seguro", () => {
  it("zero sem unidade sobrevive", () => {
    // O caso exato que quebrou a capa.
    const limpo = limparCorpo('<p style="margin: 0 0 18px">x</p>');
    assert.match(limpo, /margin:0 0 18px/);

    for (const estilo of ["margin: 0", "padding: 0", "width: 0", "margin: 0 12px"]) {
      const html = limparCorpo(`<p style="${estilo}">x</p>`);
      assert.ok(
        declaracoes(html).length === 1,
        `"${estilo}" foi descartado — é CSS válido`,
      );
    }
  });

  it("o que é perigoso continua saindo", () => {
    // A trava do outro lado: afrouxar a régua do zero não pode ter aberto a
    // porta para valor arbitrário, que é o que faria a página pública de
    // conferência virar superfície de ataque.
    for (const estilo of [
      "margin: 0 0 18px; position: fixed",
      "margin: expression(alert(1))",
      "width: 100vw",
      "padding: -4px",
    ]) {
      const html = limparCorpo(`<p style="${estilo}">x</p>`);
      const sobrou = declaracoes(html);
      assert.ok(
        !sobrou.some((d) => /position|expression|vw|-4/.test(d)),
        `"${estilo}" passou: ${sobrou.join(" | ")}`,
      );
    }

    assert.equal(limparCorpo('<script>alert(1)</script><p>ok</p>'), "<p>ok</p>");
  });

  it("nenhum modelo semeado perde estilo no caminho", () => {
    /**
     * A regressão de verdade.
     *
     * Não basta o zero funcionar num teste sintético: o que importa é que o
     * modelo escrito na migration chegue à folha como foi escrito. Qualquer
     * declaração que o sanitizador engula aqui é desenho que o cliente pediu e
     * não vai receber — foi exatamente assim que a capa saiu chapada.
     */
    for (const arquivo of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) {
      const sql = readFileSync(path.join(MIGRATIONS, arquivo), "utf8");

      for (const achado of sql.matchAll(/\$corpo\$([\s\S]*?)\$corpo\$/g)) {
        const corpo = achado[1]!;
        const sobreviveram = new Set(declaracoes(limparCorpo(corpo)));
        const perdidas = [...new Set(declaracoes(corpo))]
          .filter((declaracao) => !sobreviveram.has(declaracao));

        assert.deepEqual(
          perdidas, [],
          `${arquivo}: o sanitizador descartou ${perdidas.join(", ")}`,
        );
      }
    }
  });
});
