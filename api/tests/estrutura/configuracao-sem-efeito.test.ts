import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path, { join } from "node:path";

const RAIZ_API = path.join(__dirname, "..", "..", "src");
const RAIZ_WEB = path.join(__dirname, "..", "..", "..", "web", "src");

const arquivos = (pasta: string): string[] =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(entrada.name) ? [caminho] : [];
  });

const conteudo = (raiz: string) =>
  arquivos(raiz).map((caminho) => ({ caminho, texto: readFileSync(caminho, "utf8") }));

/**
 * Configuração que o banco guarda e nenhum código lê.
 *
 * O projeto já pagou por isso três vezes — `dados_contratante`,
 * `usuario_permissao` e a visibilidade estendida da etapa. O padrão é sempre o
 * mesmo: a tela oferece a opção, o banco grava, e o comportamento não muda. O
 * usuário configura, confere, reconfigura, e acaba abrindo chamado sobre uma
 * caixa que nunca fez nada.
 *
 * A regra: **quem oferece, lê**. Uma coluna pode existir sem leitor — é o caso
 * de dado guardado para depois. O que não pode é ter formulário.
 */
test("a visibilidade estendida não volta ao formulário sem quem a leia", () => {
  const lida = conteudo(RAIZ_API).some(({ caminho, texto }) =>
    // Escrever a coluna não conta: `INSERT` e `SELECT ... AS` só a levam e a
    // trazem. Ler é decidir alguma coisa com ela.
    !caminho.includes("PostgresFluxoConfiguracaoRepository")
    && /visibilidade_estendida|visibilidadeEstendida/.test(texto)
    && !caminho.includes("ports/")
    && !caminho.includes("schemas/"));

  const oferecida = conteudo(RAIZ_WEB).some(({ texto }) =>
    /<input[\s\S]{0,200}visibilidadeEstendida/.test(texto));

  if (oferecida && !lida) {
    assert.fail(
      "O painel de fluxos voltou a oferecer 'ver processos fora da etapa', e nenhuma "
      + "consulta filtra por ela. Ou escreva a consulta, ou tire o campo da tela: "
      + "configuração sem efeito já rendeu três bugs neste projeto.",
    );
  }
});
