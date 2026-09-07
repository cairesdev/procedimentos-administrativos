import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cnhValida, cnsValido, conferirDocumentos, cpfValido, nisValido, rgAceitavel,
} from "../../src/domain/saude/DocumentosDoPaciente";

/**
 * Os cinco documentos do paciente.
 *
 * O que estes testes protegem não é o algoritmo — é a decisão de que **nenhum
 * documento é obrigatório** e de que o que se confere é o dígito, não a
 * existência. Um teste que exigisse CNS aqui seria o primeiro passo para o
 * formulário exigir CNS no balcão, que é como nasce número inventado.
 */

describe("Cartão do SUS", () => {
  it("aceita o definitivo e o provisório", () => {
    // Gerados para fechar em módulo 11; começam em 1/2 (definitivo) e 7/8/9.
    assert.ok(cnsValido("286122138783757"));
    assert.ok(cnsValido("761078852611491"));
  });

  it("recusa o que não fecha o dígito", () => {
    assert.ok(!cnsValido("286122138783758"));
  });

  it("recusa tamanho errado e primeiro dígito impossível", () => {
    assert.ok(!cnsValido("12345"));
    // Cartão do SUS nunca começa em 3, 4, 5 ou 6.
    assert.ok(!cnsValido("386122138783757"));
  });

  it("ignora pontuação: a recepção digita com espaço", () => {
    assert.ok(cnsValido("2861 2213 8783 757"));
  });
});

describe("CPF", () => {
  it("aceita um válido", () => {
    assert.ok(cpfValido("52998224725"));
  });

  it("recusa os onze repetidos, que passam no cálculo", () => {
    // 111.111.111-11 fecha os dois dígitos e é o valor que alguém digita para
    // "preencher o campo".
    assert.ok(!cpfValido("11111111111"));
    assert.ok(!cpfValido("00000000000"));
  });

  it("recusa dígito verificador errado", () => {
    assert.ok(!cpfValido("52998224724"));
  });
});

describe("NIS e CNH", () => {
  it("conferem o dígito", () => {
    assert.ok(nisValido("12056412545"));
    assert.ok(!nisValido("12056412548"));
    assert.ok(!nisValido("11111111111"));
  });

  it("a CNH tem dois verificadores", () => {
    assert.ok(cnhValida("02650306461"));
    assert.ok(!cnhValida("02650306462"));
  });
});

describe("RG", () => {
  /**
   * Não existe dígito verificador nacional de RG.
   *
   * Cada estado emite no seu formato, alguns com letra, alguns com "X".
   * Conferir seria inventar uma regra e recusar documento verdadeiro — pior
   * que aceitar um errado, porque o RG aqui é pista de busca, não chave.
   */
  it("aceita qualquer coisa de tamanho plausível", () => {
    assert.ok(rgAceitavel("12.345.678-X"));
    assert.ok(rgAceitavel("MG-12.345.678"));
  });

  it("recusa só o que é curto ou longo demais", () => {
    assert.ok(!rgAceitavel("12"));
    assert.ok(!rgAceitavel("1".repeat(30)));
  });
});

describe("conferência do cadastro inteiro", () => {
  it("devolve todos os problemas de uma vez", () => {
    // Um por vez faria a tela recusar quatro vezes seguidas com a pessoa
    // esperando em pé no balcão.
    const { problemas } = conferirDocumentos({
      cpf: "11111111111",
      cns: "999",
      nis: "12056412548",
    });
    assert.equal(problemas.length, 3);
  });

  it("limpa a pontuação do que passou", () => {
    const { limpos } = conferirDocumentos({ cpf: "529.982.247-25" });
    assert.equal(limpos.cpf, "52998224725");
  });

  it("campo em branco vira nulo, e não erro", () => {
    const { limpos, problemas } = conferirDocumentos({ cpf: "", cns: "   " });
    assert.deepEqual(problemas, []);
    assert.equal(limpos.cpf, null);
    assert.equal(limpos.cns, null);
  });

  it("paciente sem documento nenhum passa", () => {
    // É o inconsciente sem acompanhante. Exigir documento antes de atender não
    // produz dado limpo — produz número inventado.
    const { limpos, problemas } = conferirDocumentos({});
    assert.deepEqual(problemas, []);
    assert.deepEqual(limpos, {});
  });
});
