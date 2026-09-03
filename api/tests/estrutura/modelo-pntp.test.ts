import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CLASSIFICACOES } from "../../src/domain/checklist/SituacaoDoItem";

/**
 * O modelo global do PNTP, conferido no arquivo.
 *
 * Ele é semeado por migration e ninguém o edita à mão depois — então o que
 * garante que os 53 critérios continuam lá, com código e classificação, é ler
 * o próprio SQL. Um `INSERT` truncado numa edição futura passaria calado.
 */

const migrations = path.join(__dirname, "..", "..", "db", "migrations");

const pntp = () => {
  const arquivo = readdirSync(migrations).find((nome) => nome.includes("modelo_pntp"));
  assert.ok(arquivo, "a migration do PNTP sumiu");
  return readFileSync(path.join(migrations, arquivo!), "utf8");
};

describe("o modelo global do PNTP", () => {
  const sql = pntp();

  it("é global, sem prefeitura dona", () => {
    // `orgao_id` nulo é o que faz o modelo valer para todas: o critério vem do
    // Tribunal, e é o mesmo para todo município.
    assert.match(sql, /INSERT INTO checklist_modelo \(orgao_id, nome, descricao\)/);
    assert.match(sql, /VALUES \(NULL,/);
  });

  it("traz os 53 critérios", () => {
    // Uma linha por critério, cada uma abrindo com a ordem e o código.
    const linhas = [...sql.matchAll(/^ {2}\(\d+, '[\d.]+',/gm)];
    assert.equal(linhas.length, 53, `achei ${linhas.length} critérios`);
  });

  it("todo critério tem código, seção e classificação do vocabulário", () => {
    const criterios = [...sql.matchAll(
      /^ {2}\((\d+), '([\d.]+)', '([^']+)',/gm,
    )];
    assert.equal(criterios.length, 53);

    for (const [, ordem, codigo, secao] of criterios) {
      assert.match(codigo!, /^\d+\.\d+$/, `código estranho: ${codigo}`);
      assert.ok(secao!.trim().length > 0, `critério ${codigo} sem seção`);
      assert.ok(Number(ordem) > 0);
    }

    // A classificação fecha cada linha, e só o vocabulário entra.
    const classes = [...sql.matchAll(/, '(OBRIGATORIA|ESSENCIAL|RECOMENDADA)', TRUE\)/g)];
    assert.equal(classes.length, 53, `${classes.length} classificações para 53 critérios`);

    for (const [, classe] of classes) {
      assert.ok(
        (CLASSIFICACOES as readonly string[]).includes(classe!),
        `${classe} não está no vocabulário do domínio`,
      );
    }
  });

  it("os códigos não se repetem", () => {
    // Dois `8.5` seriam dois critérios diferentes com o mesmo nome oficial, e
    // a controladoria não saberia de qual o TCE está falando.
    const codigos = [...sql.matchAll(/^ {2}\(\d+, '([\d.]+)',/gm)].map((a) => a[1]!);
    assert.equal(new Set(codigos).size, codigos.length, "há código repetido");
  });

  it("o índice único do nome global existe", () => {
    /**
     * `UNIQUE (orgao_id, nome)` não alcança os globais: em SQL, dois `NULL`
     * não são iguais, e o mesmo modelo global entraria duas vezes.
     */
    assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*?WHERE orgao_id IS NULL/);
  });

  it("a sugestão de setor sai do texto e vira coluna", () => {
    /**
     * A 0037 escreveu "Setor sugerido pelo TCE: CONTABILIDADE" dentro da
     * descrição, onde só serve a quem lê item por item — e aplicar o modelo
     * custava 53 atribuições à mão. A 0045 extrai para `setor_sugerido`, que o
     * sistema casa com o organograma de quem aplica.
     *
     * Este teste segura as duas pontas: a extração precisa continuar existindo,
     * e o texto de origem precisa continuar no formato que ela reconhece.
     */
    const extracao = readdirSync(migrations).find((nome) => nome.includes("setor_sugerido"));
    assert.ok(extracao, "a migration que extrai o setor sugerido sumiu");

    const sqlDaExtracao = readFileSync(path.join(migrations, extracao!), "utf8");
    assert.match(sqlDaExtracao, /ADD COLUMN setor_sugerido/);
    assert.match(sqlDaExtracao, /Setor sugerido pelo TCE:/);

    // Se a 0037 mudar a frase, a 0045 extrai nada — calada.
    const sugestoes = [...sql.matchAll(/Setor sugerido pelo TCE: ([^.]+)\./g)];
    assert.ok(sugestoes.length >= 40, `só ${sugestoes.length} critérios trazem sugestão`);
    for (const [, nome] of sugestoes) {
      assert.ok(nome!.trim().length > 0, "sugestão vazia");
      assert.ok(nome!.length <= 120, `sugestão com ${nome!.length} caracteres não cabe na coluna`);
    }
  });

  it("o título cabe no campo", () => {
    // 200 caracteres foi a medida pensada para "Certidão negativa"; o critério
    // do PNTP é uma pergunta inteira, e o maior tem 247.
    const titulos = [...sql.matchAll(/^ {2}\(\d+, '[\d.]+', '[^']+',\n {3}?'([^']*)'/gm)];
    for (const [, titulo] of titulos) {
      assert.ok(titulo!.length <= 500, `título com ${titulo!.length} caracteres`);
    }
  });
});
