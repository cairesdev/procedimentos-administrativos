import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path, { join } from "node:path";

const RAIZ_WEB = path.join(__dirname, "..", "..", "..", "web", "src");

const arquivos = (pasta: string): string[] =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(entrada.name) ? [caminho] : [];
  });

/**
 * `x!.y` num componente de cliente é um bug que ninguém vê.
 *
 * A asserção non-null não gera checagem alguma: ela apenas manda o compilador
 * calar sobre a possibilidade de `x` ser nulo. Num Server Component isso ainda
 * estoura no log do servidor, onde alguém percebe. Num componente de cliente o
 * erro acontece no navegador, **durante o render** — o React descarta a árvore
 * inteira, a página fica em branco e o servidor não registra nada.
 *
 * Foi assim que a tela de devoluções quebrou: `lote.id` sobre um furo na lista
 * de lotes, com `Cannot read properties of null (reading 'id')` no console e
 * silêncio absoluto do lado de cá. Este teste existe para que a próxima vez
 * pare no CI e não na prefeitura.
 *
 * A saída não é escrever `!` mais bonito, e sim decidir o que a tela faz quando
 * o dado não veio: `?.` com valor padrão, `flatMap` que descarta o que não
 * serve, ou uma condição que não desenha o trecho.
 */
test("nenhum componente de cliente usa asserção non-null", () => {
  const infratores: string[] = [];

  for (const caminho of arquivos(RAIZ_WEB)) {
    const conteudo = readFileSync(caminho, "utf8");
    if (!conteudo.startsWith('"use client";')) continue;

    conteudo.split("\n").forEach((linha, indice) => {
      // `!.` de asserção, e não `!==`, `!variavel` nem o `!` de negação.
      if (/[\w\])]!\./.test(linha)) {
        infratores.push(`${caminho.replace(RAIZ_WEB, "web/src")}:${indice + 1}: ${linha.trim()}`);
      }
    });
  }

  assert.deepEqual(
    infratores,
    [],
    "Asserção non-null em componente de cliente — o erro dela não aparece no log:\n"
    + infratores.join("\n"),
  );
});
