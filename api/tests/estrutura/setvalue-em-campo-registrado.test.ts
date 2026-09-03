import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path, { join } from "node:path";

const RAIZ_WEB = path.join(__dirname, "..", "..", "..", "web", "src");

const arquivos = (pasta: string): string[] =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.tsx$/.test(entrada.name) ? [caminho] : [];
  });

/** `lotes.${index}.nomeBem` e `lotes.0.nomeBem` são o mesmo campo. */
const semIndice = (nome: string) => nome.replace(/\$\{[^}]*\}/g, "*");

/**
 * Sem os comentários.
 *
 * A primeira versão desta regra acusava o próprio arquivo corrigido: o
 * comentário que explica por que o `setValue` saiu de lá cita o `setValue` que
 * saiu. Código é o que roda.
 */
const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const nomesEm = (texto: string, funcao: "setValue" | "register") =>
  [...texto.matchAll(new RegExp(`${funcao}\\(\\s*["\`]([^"\`]+)["\`]`, "g"))]
    .map((achado) => semIndice(achado[1]!));

/**
 * `setValue` sobre campo que o formulário nunca registrou.
 *
 * A biblioteca guarda o valor nesse caso, e a documentação dela pede que não se
 * dependa disso: quem observa o campo pode não ser avisado, o componente não
 * torna a desenhar, e um `<select>` controlado volta sozinho para o valor
 * anterior. Para quem está usando, o campo "não aceita clique".
 *
 * Foi o que aconteceu no assistente de checklist: `alvoTipo` e `alvoId` eram
 * escritos por `setValue` e lidos por `watch`, e o JSX que os desenha —
 * `TargetPicker` — é controlado por props, sem `register` nenhum. O seletor de
 * referência ficava preso em "— lista avulsa —".
 *
 * A saída não é registrar um campo escondido: é o estado do React, que sempre
 * redesenha, com o valor entrando no formulário na hora de enviar. É como os
 * itens já eram tratados, e pela mesma razão.
 */
test("setValue só escreve em campo que o próprio arquivo registra", () => {
  const problemas: string[] = [];

  for (const caminho of arquivos(RAIZ_WEB)) {
    const texto = semComentarios(readFileSync(caminho, "utf8"));
    const escritos = nomesEm(texto, "setValue");
    if (escritos.length === 0) continue;

    const registrados = new Set(nomesEm(texto, "register"));

    /**
     * `useController` registra tanto quanto `register`.
     *
     * É o caminho dos campos com máscara — `CurrencyField` recebe `control` e
     * `name`, e por dentro chama `useController`. Sem reconhecê-lo, a regra
     * acusaria `setValue("valor")` no despacho do processo, que está correto.
     *
     * A aproximação é deliberada: casar `name` com o elemento que recebeu o
     * `control` pediria um parser de JSX, e o falso positivo que ela permite —
     * um `name` solto num arquivo que usa `control` em outro campo — custa
     * menos que o parser.
     */
    if (texto.includes("control={")) {
      for (const achado of texto.matchAll(/name="([^"]+)"/g)) {
        registrados.add(semIndice(achado[1]!));
      }
    }

    for (const campo of escritos) {
      if (!registrados.has(campo)) {
        problemas.push(`${path.relative(RAIZ_WEB, caminho)} → setValue("${campo}")`);
      }
    }
  }

  assert.deepEqual(
    problemas, [],
    "campo escrito por setValue e nunca registrado — o componente pode não "
    + "redesenhar, e o campo parece não aceitar clique:\n" + problemas.join("\n"),
  );
});
