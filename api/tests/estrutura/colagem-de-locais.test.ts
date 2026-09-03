import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  converterPlanilhaDeLocais, sugerirSequenciaDeLocais,
} from "../../../web/src/features/stock/locais-paste";

/**
 * A colagem do cadastro de escolas.
 *
 * Mora nos testes da API porque o módulo é lógica pura do web e roda sem
 * bundler — o mesmo arranjo da colagem de entrada de estoque.
 */

const PLANILHA = [
  "CÓDIGO\tESCOLA\tCNPJ\tENDEREÇO\tMUNICÍPIO\tUF\tDIRETORA",
  "001\tESCOLA MUNICIPAL SÃO JOSÉ\t12.345.678/0001-90\tRua A, 100\tMonção\tMA\tMaria da Silva",
  "002\tCRECHE CENTRAL\t98.765.432/0001-10\tAv. B, 50\tMonção\tMA\tJoana Souza",
].join("\n");

describe("colar o cadastro de escolas", () => {
  it("o cabeçalho da planilha vira a sequência sugerida", () => {
    const sugestao = sugerirSequenciaDeLocais(PLANILHA);
    assert.deepEqual(sugestao, [
      "codigo", "nome", "cnpj", "endereco", "municipio", "uf", "responsavel",
    ]);
  });

  it("com a sequência aceita, cada linha vira uma escola", () => {
    const sequencia = sugerirSequenciaDeLocais(PLANILHA)!;
    const { linhas, temCabecalho, ignoradas } = converterPlanilhaDeLocais(PLANILHA, sequencia);

    assert.equal(temCabecalho, true, "a linha de título entrou como escola");
    assert.equal(ignoradas, 0);
    assert.equal(linhas.length, 2);
    assert.equal(linhas[0]!.codigo, "001");
    assert.equal(linhas[0]!.nome, "ESCOLA MUNICIPAL SÃO JOSÉ");
    // A máscara viaja como está: limpar é decisão do domínio, do lado da API.
    assert.equal(linhas[0]!.cnpj, "12.345.678/0001-90");
    assert.equal(linhas[1]!.responsavel, "Joana Souza");
  });

  it("o CNPJ é o que distingue cabeçalho de dado", () => {
    /**
     * `pareceCabecalho` pergunta se os campos numéricos têm dígito, e numa
     * planilha de escolas não há quantidade nem valor. Sem CNPJ e CEP nesse
     * papel, a linha de título entraria como escola chamada "ESCOLA".
     */
    const semCnpj = ["CÓDIGO\tESCOLA", "001\tSÃO JOSÉ"].join("\n");
    const comCnpj = ["CÓDIGO\tESCOLA\tCNPJ", "001\tSÃO JOSÉ\t12345678000190"].join("\n");

    assert.equal(
      converterPlanilhaDeLocais(semCnpj, ["codigo", "nome"]).temCabecalho, false,
    );
    assert.equal(
      converterPlanilhaDeLocais(comCnpj, ["codigo", "nome", "cnpj"]).temCabecalho, true,
    );
  });

  it("coluna que não interessa fica de fora sem deslocar as outras", () => {
    // "item nº" na frente é o caso clássico da planilha de prefeitura.
    const comSobra = "1\t001\tSÃO JOSÉ\tobservação qualquer";
    const { linhas } = converterPlanilhaDeLocais(comSobra, [null, "codigo", "nome", null]);

    assert.equal(linhas[0]!.codigo, "001");
    assert.equal(linhas[0]!.nome, "SÃO JOSÉ");
  });

  it("linha sem nome é descartada e contada", () => {
    // Rodapé, total, linha de seção — o que vem junto na cópia.
    const comRodape = ["001\tSÃO JOSÉ", "\t", "TOTAL\t"].join("\n");
    const { linhas, ignoradas } = converterPlanilhaDeLocais(comRodape, ["codigo", "nome"]);

    assert.equal(linhas.length, 1);
    assert.equal(ignoradas, 1, "o rodapé precisa aparecer na contagem");
  });

  it("linha com código e sem nome segue para a API, para voltar no relatório", () => {
    /**
     * Aqui o obrigatório é o nome; a escola sem **código** é erro que o
     * domínio nomeia. Sumir com ela no navegador quebraria a promessa de que
     * tudo o que ficou de fora aparece com o número da linha.
     */
    const semCodigo = "\tESCOLA SEM CÓDIGO";
    const { linhas } = converterPlanilhaDeLocais(semCodigo, ["codigo", "nome"]);

    assert.equal(linhas.length, 1);
    assert.equal(linhas[0]!.codigo, "");
  });

  it("planilha com uma coluna reconhecida não é tratada como cabeçalho", () => {
    // Uma escola chamada "MUNICIPAL CENTRO" casaria com "municipio" sozinha.
    assert.equal(sugerirSequenciaDeLocais("MUNICIPAL CENTRO\t001"), null);
  });
});
