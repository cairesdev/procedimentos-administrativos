import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * O modelo global de liquidação e pagamento, conferido no arquivo.
 *
 * Semeado por migration e nunca editado à mão — então o que garante que as sete
 * etapas continuam lá, com o fornecedor nas três que são dele, é ler o próprio
 * SQL. Uma edição futura que trocasse um `TRUE` de lugar mudaria quem vê o quê
 * no link externo, e passaria calada.
 */

const migrations = path.join(__dirname, "..", "..", "db", "migrations");

const sqlDoPagamento = () => {
  const arquivo = readdirSync(migrations).find((nome) => nome.includes("modelo_pagamento"));
  assert.ok(arquivo, "a migration do modelo de pagamento sumiu");
  return readFileSync(path.join(migrations, arquivo!), "utf8");
};

/** Uma linha por etapa: `(ordem, 'seção', 'título', 'descrição', anexo, fornecedor)`. */
const etapas = (sql: string) => [...sql.matchAll(
  /^ {2}\((\d+), '([^']+)',\n {3}'([^']+)',\n[\s\S]*?\n {3}(TRUE|FALSE), (TRUE|FALSE)\)/gm,
)].map((achado) => ({
  ordem: Number(achado[1]),
  secao: achado[2]!,
  titulo: achado[3]!,
  exigeAnexo: achado[4] === "TRUE",
  paraFornecedor: achado[5] === "TRUE",
}));

describe("o modelo global de liquidação e pagamento", () => {
  const sql = sqlDoPagamento();
  const lista = etapas(sql);

  it("é global, sem prefeitura dona", () => {
    // As sete etapas vêm da lei e da instrução do Tribunal, não do organograma
    // de um município. O que muda entre prefeituras é quem faz cada uma.
    assert.match(sql, /INSERT INTO checklist_modelo \(orgao_id, nome, descricao\)/);
    assert.match(sql, /VALUES \(NULL, 'Liquidação e pagamento ao fornecedor'/);
  });

  it("traz as sete etapas, numeradas em ordem", () => {
    assert.equal(lista.length, 7, `achei ${lista.length} etapas`);
    assert.deepEqual(lista.map((etapa) => etapa.ordem), [1, 2, 3, 4, 5, 6, 7]);
  });

  it("põe no fornecedor exatamente a cobrança que é dele", () => {
    // Solicitação de pagamento, nota fiscal e certidões: é o que ele apresenta,
    // e é o que aparece no link externo. Marcar um item interno como do
    // fornecedor o exporia a quem não é da prefeitura; deixar de marcar um dele
    // o esconderia de quem precisa entregar.
    const doFornecedor = lista.filter((etapa) => etapa.paraFornecedor).map((e) => e.ordem);
    assert.deepEqual(doFornecedor, [2, 3, 4]);
  });

  it("mantém a ordem de fornecimento e as conferências dentro de casa", () => {
    const internos = lista.filter((etapa) => !etapa.paraFornecedor).map((e) => e.ordem);
    assert.deepEqual(internos, [1, 5, 6, 7]);
  });

  it("exige documento em toda etapa", () => {
    // Etapa marcada como cumprida sem o documento é o que a prestação de contas
    // não aceita: o processo de pagamento vale pelas peças que carrega.
    const semAnexo = lista.filter((etapa) => !etapa.exigeAnexo);
    assert.deepEqual(semAnexo, [], "etapa sem exigência de anexo");
  });

  it("não fixa prazo em dias", () => {
    // O relógio da liquidação começa em eventos diferentes conforme o contrato
    // — entrega, medição, aceite. Prazo errado no modelo vira data errada em
    // toda cópia aplicada.
    assert.doesNotMatch(sql, /prazo_dias/);
  });

  it("cita as cinco certidões pelo nome", () => {
    // "Certidões de regularidade" no plural esconde qual delas falta.
    for (const certidao of ["Municipal", "Estadual", "Federal", "FGTS", "CNDT"]) {
      assert.match(sql, new RegExp(certidao), `a certidão ${certidao} sumiu do texto`);
    }
  });
});
