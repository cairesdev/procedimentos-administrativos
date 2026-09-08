import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Nenhum "hoje" do sistema sai do relógio de Greenwich.
 *
 * `new Date().toISOString().slice(0, 10)` parece o jeito óbvio de pegar a data
 * de hoje e é o dia **UTC**: das 21h em diante, em Brasília, ele já devolve
 * amanhã. O estrago é sempre o mesmo e sempre discreto — um prazo que vence à
 * noite, uma sessão de terça registrada como quarta, uma criança de 3 anos e
 * 364 dias contada na faixa dos 4 no relatório que vai para a Promotoria.
 *
 * O defeito apareceu quatro vezes neste projeto: no domínio dos programas (que
 * ganhou `DataDoCalendario.ts`), na página pública do checklist, no prazo da
 * exigência do protocolo e na própria suíte de testes, que passava aqui e
 * falhava na máquina do João. Quatro é bem depois da hora de escrever o guarda.
 *
 * **Duas coisas continuam certas e não são acusadas.** `toISOString()` inteiro,
 * para gravar um instante em UTC, é o uso correto. E conta de dias feita
 * inteiramente em UTC — `setUTCDate` a partir de uma data-só — não tem relógio
 * local no meio e não anda: é o que `vigenciaAte` faz.
 */

const raiz = path.join(import.meta.dirname, "..", "..");

const varrer = (pasta: string, encontrados: string[] = []): string[] => {
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === "dist") continue;
      varrer(caminho, encontrados);
    } else if (entrada.name.endsWith(".ts")) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
};

/**
 * Comentário é onde se explica o defeito — e onde ele não faz mal nenhum.
 *
 * Sem tirá-los, o guarda acusaria justamente os arquivos que documentam a
 * armadilha, `DataDoCalendario.ts` na frente.
 */
const semComentarios = (conteudo: string): string =>
  conteudo.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const semEspacos = (conteudo: string): string => conteudo.replace(/\s+/g, "");

/** O **dia de hoje** tirado do relógio UTC — sempre defeito. */
const HOJE_EM_UTC = /newDate\((?:\)|Date\.now\(\)[^)]*\))\.toISOString\(\)\.slice\(0,10\)/;

/**
 * `new Date("2026-09-08")` — data de calendário lida como meia-noite UTC.
 *
 * Vale em teste, onde às vezes é o instante que se quer fixar; em `src` é
 * sempre defeito, e `comoDataLocal` existe exatamente para isso.
 */
const DATA_CRUA = /newDate\(["'`]\d{4}-\d{2}-\d{2}["'`]\)/;

describe("o dia é o do município, não o de Greenwich", () => {
  const arquivos = [
    ...varrer(path.join(raiz, "src")),
    ...varrer(path.join(raiz, "tests")),
  ];

  it("acha os arquivos", () => {
    assert.ok(arquivos.length > 100, `só ${arquivos.length} arquivos — a varredura falhou`);
  });

  /**
   * Sem isto, uma regex quebrada faria o guarda passar sem olhar nada — que é
   * a pior forma de um guarda falhar, porque parece verde.
   */
  it("as regras ainda acusam o que devem acusar", () => {
    assert.ok(HOJE_EM_UTC.test(semEspacos("new Date().toISOString().slice(0, 10)")));
    assert.ok(HOJE_EM_UTC.test(
      semEspacos("new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)"),
    ));
    assert.ok(DATA_CRUA.test(semEspacos('new Date("2026-09-08")')));

    // E não acusam a conta de dias feita inteirinha em UTC, que não anda.
    assert.ok(!HOJE_EM_UTC.test(semEspacos(
      'const d = new Date(`${dia}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n);'
      + " return d.toISOString().slice(0, 10);",
    )));
  });

  for (const arquivo of arquivos) {
    const nome = path.relative(raiz, arquivo);
    if (nome.includes("dia-do-calendario")) continue; // Este cita o que proíbe.

    const codigo = semEspacos(semComentarios(readFileSync(arquivo, "utf8")));

    it(`${nome} não tira o dia de hoje do UTC`, () => {
      assert.ok(
        !HOJE_EM_UTC.test(codigo),
        "`new Date().toISOString().slice(0, 10)` devolve o dia em UTC — depois "
        + "das 21h em Brasília ele já é o de amanhã. Monte a data com "
        + "`getFullYear/getMonth/getDate`, que são locais.",
      );
    });

    if (nome.startsWith(`src${path.sep}`)) {
      it(`${nome} não lê data de calendário como instante UTC`, () => {
        assert.ok(
          !DATA_CRUA.test(codigo),
          '`new Date("2026-09-08")` é meia-noite UTC, que em Brasília é dia 7 '
          + "às 21h — a data anda um dia para trás. Use `comoDataLocal` de "
          + "`domain/programa/DataDoCalendario.ts`.",
        );
      });
    }
  }
});
