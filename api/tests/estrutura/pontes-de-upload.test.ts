import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Toda ponte repassa o `Content-Type`.
 *
 * O `boundary` do multipart vive dentro desse cabeçalho, e o corpo atravessa
 * a ponte como stream **já codificado** — o fetch só regeneraria o boundary se
 * recebesse um `FormData` montado por ele, o que não é o caso.
 *
 * As três pontes omitiam o cabeçalho no multipart, com a intenção de deixar o
 * fetch cuidar disso. O efeito era o contrário: o multer não encontrava o
 * arquivo e devolvia "Arquivo ausente". Anexo de processo, de checklist e do
 * requerente — nenhum subia.
 */

const api = path.join(__dirname, "..", "..", "..", "web", "src", "app", "api");

/** Toda `route.ts` sob `app/api` que encaminha para a API. */
const pontes = (pasta: string, achadas: string[] = []): string[] => {
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) pontes(caminho, achadas);
    else if (entrada.name === "route.ts") {
      const conteudo = readFileSync(caminho, "utf8");
      /**
       * Só as que repassam o corpo **como stream**.
       *
       * A ponte que monta o próprio JSON e fixa `application/json` não tem
       * boundary a perder — exigir dela o repasse seria cobrar cuidado que
       * não se aplica, e um teste que cobra o que não importa ensina a
       * ignorá-lo.
       */
      if (conteudo.includes("apiBaseUrl") && /body:[\s\S]{0,80}request\.body/.test(conteudo)) {
        achadas.push(caminho);
      }
    }
  }
  return achadas;
};

describe("as pontes não perdem o boundary do multipart", () => {
  const arquivos = pontes(api);

  it("há pontes para conferir", () => {
    // Sem esta guarda, uma mudança de estrutura faria o teste passar vazio.
    assert.ok(arquivos.length >= 3, `só ${arquivos.length} pontes encontradas`);
  });

  for (const arquivo of arquivos) {
    const nome = path.relative(api, arquivo);

    it(`${nome} repassa o Content-Type`, () => {
      const conteudo = readFileSync(arquivo, "utf8");

      /**
       * O padrão exato que causou o bug: pular o cabeçalho quando é multipart.
       * Procurado pela forma, e não pela intenção — foi copiado três vezes, e
       * a quarta cópia entraria pelo mesmo caminho.
       */
      assert.ok(
        !/!isMultipart\s*\?\s*\{\s*"Content-Type"/.test(conteudo),
        "omite o Content-Type no multipart: o boundary se perde e o arquivo não sobe",
      );

      // E precisa repassá-lo de fato — não basta não ter o padrão errado.
      assert.match(
        conteudo,
        /"Content-Type": contentType/,
        "não repassa o Content-Type para a API",
      );
    });
  }
});
