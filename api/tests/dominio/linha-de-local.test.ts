import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizarLinhaDeLocal } from "../../src/domain/almoxarifado/LinhaDeLocal";

const aproveitada = (linha: Parameters<typeof normalizarLinhaDeLocal>[0]) => {
  const resultado = normalizarLinhaDeLocal(linha);
  assert.ok(resultado.aproveitavel, `linha recusada: ${JSON.stringify(resultado)}`);
  return resultado;
};

describe("a linha de planilha virando escola", () => {
  it("o caso comum passa inteiro", () => {
    const { local, avisos } = aproveitada({
      codigo: " 001 ", nome: "  ESCOLA MUNICIPAL SÃO JOSÉ ",
      cnpj: "12.345.678/0001-90", endereco: "Rua A, 100", bairro: "Centro",
      municipio: "Monção", uf: "ma", cep: "65.380-000",
      telefone: "(98) 3644-1234", email: "Escola@Moncao.MA.GOV.BR",
      responsavel: "Maria da Silva",
    });

    assert.equal(local.codigo, "001");
    assert.equal(local.nome, "ESCOLA MUNICIPAL SÃO JOSÉ");
    // Máscara é da tela; o banco guarda o número.
    assert.equal(local.cnpj, "12345678000190");
    assert.equal(local.cep, "65380000");
    assert.equal(local.uf, "MA");
    assert.equal(local.email, "escola@moncao.ma.gov.br");
    assert.deepEqual(avisos, []);
  });

  it("espaço em excesso no meio do nome vira um só", () => {
    // Colagem de planilha traz isso o tempo todo.
    assert.equal(aproveitada({ codigo: "1", nome: "ESCOLA   SÃO  JOSÉ" }).local.nome,
      "ESCOLA SÃO JOSÉ");
  });

  it("sem código ou sem nome não há escola", () => {
    const semCodigo = normalizarLinhaDeLocal({ nome: "ESCOLA NOVA" });
    assert.equal(semCodigo.aproveitavel, false);
    assert.match((semCodigo as { motivo: string }).motivo, /sem código/);

    const semNome = normalizarLinhaDeLocal({ codigo: "007" });
    assert.equal(semNome.aproveitavel, false);
    assert.match((semNome as { motivo: string }).motivo, /007.*sem nome/);
  });

  it("linha em branco é dito assim, e não como erro de campo", () => {
    const vazia = normalizarLinhaDeLocal({ codigo: "  ", nome: "", cnpj: "" });
    assert.equal(vazia.aproveitavel, false);
    assert.equal((vazia as { motivo: string }).motivo, "linha em branco");
  });

  it("código e nome não são cortados: são a identidade", () => {
    /**
     * Código cortado casaria com outra escola; nome cortado entra no romaneio.
     * Nos dois casos é melhor a linha ficar de fora, nomeada no relatório.
     */
    const codigoLongo = normalizarLinhaDeLocal({ codigo: "0123456789A", nome: "ESCOLA" });
    assert.equal(codigoLongo.aproveitavel, false);

    const nomeLongo = normalizarLinhaDeLocal({ codigo: "1", nome: "E".repeat(151) });
    assert.equal(nomeLongo.aproveitavel, false);
  });

  it("CNPJ ilegível não derruba a escola — fica em branco, com aviso", () => {
    // A escola entra e alguém corrige um CNPJ. O contrário é refazer a
    // planilha inteira por causa de uma célula.
    const { local, avisos } = aproveitada({
      codigo: "002", nome: "ESCOLA B", cnpj: "1234",
    });
    assert.equal(local.cnpj, null);
    assert.match(avisos[0]!, /CNPJ com 4 dígitos/);
  });

  it("CEP, UF e e-mail seguem a mesma regra", () => {
    const { local, avisos } = aproveitada({
      codigo: "003", nome: "ESCOLA C",
      cep: "6538", uf: "MARANHÃO", email: "sem-arroba",
    });
    assert.equal(local.cep, null);
    assert.equal(local.uf, null);
    assert.equal(local.email, null);
    assert.equal(avisos.length, 3);
  });

  it("texto longo é cortado com aviso, nunca em silêncio", () => {
    const { local, avisos } = aproveitada({
      codigo: "004", nome: "ESCOLA D", endereco: "R".repeat(210),
    });
    assert.equal(local.endereco!.length, 200);
    assert.match(avisos[0]!, /endereço passava de 200/);
  });

  it("campo ausente vira nulo, e não string vazia", () => {
    // `''` no banco é um endereço que existe e está vazio — mentira diferente
    // de "não informado", e que estraga o `coalesce` de quem lê.
    const { local } = aproveitada({ codigo: "005", nome: "ESCOLA E" });
    assert.equal(local.endereco, null);
    assert.equal(local.cnpj, null);
    assert.equal(local.responsavel, null);
  });
});
