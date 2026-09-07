import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Em arquivo `"use server"`, todo export precisa ser `async` **literal**.
 *
 * O Next exige a palavra, não a promessa: `export const salvar = () =>
 * runAction(...)` devolve uma promise e mesmo assim é recusado, com
 * "Server Actions must be async functions". E o typecheck não vê diferença
 * nenhuma entre as duas formas — é regra do compilador do Next, não do
 * TypeScript.
 *
 * Foi assim que o módulo de saúde derrubou o build do CI com 51 erros de uma
 * vez, depois de `tsc --noEmit` e 891 testes verdes. O defeito é invisível em
 * tudo que roda antes do `next build`, e o `next build` é a coisa mais lenta
 * do ciclo — por isso a conferência mora aqui, onde custa milissegundos.
 *
 * O que este teste **não** substitui é o `next build` em si; o que ele evita é
 * descobrir isto no CI, dez minutos depois do push.
 */

// A suíte do web roda como módulo ES: `__dirname` não existe aqui.
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..", "src");

const arquivosDe = (pasta: string): string[] =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosDe(caminho);
    return entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx") ? [caminho] : [];
  });

/** Só o começo do arquivo vale: `"use server"` no meio é outra coisa. */
const ehArquivoDeAcoes = (conteudo: string): boolean =>
  /^\s*["']use server["'];/.test(conteudo);

const arquivosDeAcoes = arquivosDe(RAIZ)
  .map((caminho) => ({ caminho, conteudo: readFileSync(caminho, "utf8") }))
  .filter(({ conteudo }) => ehArquivoDeAcoes(conteudo));

describe("server actions", () => {
  it("acha os arquivos de ações", () => {
    // Um detector que não acha nada passa sempre e não cobre nada.
    assert.ok(
      arquivosDeAcoes.length >= 5,
      `só ${arquivosDeAcoes.length} arquivos "use server" — a varredura falhou`,
    );
  });

  it("todo export de arquivo \"use server\" é uma função async", () => {
    for (const { caminho, conteudo } of arquivosDeAcoes) {
      const nome = path.relative(RAIZ, caminho);

      for (const linha of conteudo.split("\n")) {
        if (!linha.startsWith("export ")) continue;
        // `export type` e `export interface` somem na compilação e não contam.
        if (/^export (type|interface) /.test(linha)) continue;

        const constante = /^export const (\w+)\s*=/.exec(linha);
        if (constante) {
          assert.match(
            linha,
            /^export const \w+\s*=\s*async\s*(\(|function)/,
            `${nome} → ${constante[1]}: precisa ser \`async\` — o Next recusa `
            + "arrow que só devolve promise",
          );
          continue;
        }

        const funcao = /^export (async )?function (\w+)/.exec(linha);
        if (funcao) {
          assert.ok(
            funcao[1],
            `${nome} → ${funcao[2]}: precisa ser \`export async function\``,
          );
          continue;
        }

        /**
         * Qualquer outro export num arquivo de ações é erro: o Next exige que
         * **todos** sejam funções async. Uma constante exportada por engano
         * derruba o build inteiro, e a mensagem aponta para a linha errada.
         */
        assert.fail(
          `${nome}: export que não é função async — ${linha.trim().slice(0, 80)}`,
        );
      }
    }
  });
});
