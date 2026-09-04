import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path, { join } from "node:path";

const APP = path.join(__dirname, "..", "..", "..", "web", "src", "app");

const paginas = (pasta: string): string[] =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return paginas(caminho);
    return entrada.name === "page.tsx" ? [caminho] : [];
  });

const semComentarios = (fonte: string) =>
  fonte.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * A barra de filtro é uma só.
 *
 * Quinze telas montavam a sua à mão — `<form method="get">` com `<Toolbar>`,
 * campos sem rótulo visível e altura diferente da dos formulários. Na mesma
 * tela conviviam dois sotaques: o formulário com rótulo acima do campo, o
 * filtro com `aria-label` e o `<select>` cru do navegador.
 *
 * O `FilterBar` resolveu, e a regra existe para a próxima tela não recomeçar:
 * quem precisa de filtro usa o componente.
 */
/**
 * As duas telas públicas fazem consulta, não filtro.
 *
 * O cidadão digita o protocolo e o conferente digita o código do documento:
 * um campo, um botão, nenhuma lista para refinar. `FilterBar` traria "Limpar"
 * e a gramática de filtro para uma pergunta que não é filtro.
 */
const CONSULTA_PUBLICA = ["cidadao/page.tsx", "conferencia/page.tsx"];

test("nenhuma página monta a própria barra de filtro", () => {
  const artesanais = paginas(APP)
    .filter((caminho) => /<form[^>]*method="get"/.test(
      semComentarios(readFileSync(caminho, "utf8")),
    ))
    .map((caminho) => path.relative(APP, caminho).replace(/\\/g, "/"))
    .filter((relativo) => !CONSULTA_PUBLICA.includes(relativo));

  assert.deepEqual(
    artesanais, [],
    "página com formulário de filtro montado à mão; use FilterBar:\n"
    + artesanais.join("\n"),
  );
});

/**
 * Campo de filtro sem rótulo visível.
 *
 * `aria-label` serve ao leitor de tela e não serve a quem enxerga: diante de
 * três seletores lado a lado, sem rótulo, a pessoa abre um a um para descobrir
 * qual é qual. O `FilterField` põe o rótulo acima, e o `aria-label` deixa de
 * ser o único caminho.
 */
test("filtro não se apoia só no aria-label", () => {
  const problemas: string[] = [];

  for (const caminho of paginas(APP)) {
    const fonte = semComentarios(readFileSync(caminho, "utf8"));
    if (!fonte.includes("<FilterBar")) continue;

    const barra = fonte.slice(fonte.indexOf("<FilterBar"), fonte.indexOf("</FilterBar>"));
    for (const achado of barra.matchAll(/aria-label="([^"]+)"/g)) {
      problemas.push(`${path.relative(APP, caminho)} → aria-label="${achado[1]}"`);
    }
  }

  assert.deepEqual(problemas, [], `rótulo escondido dentro do FilterBar:\n${problemas.join("\n")}`);
});
