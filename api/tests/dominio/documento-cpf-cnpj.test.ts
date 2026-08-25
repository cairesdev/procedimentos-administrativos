import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  documentoValido, formatarDocumento, somenteDigitos,
} from "../../src/domain/protocolo/Documento";

/**
 * O documento é metade da chave da consulta pública: errado no cadastro, o
 * cidadão fica sem conseguir acompanhar o próprio pedido e não tem a quem
 * recorrer além de voltar ao balcão.
 */
describe("CPF e CNPJ do requerente", () => {
  it("aceita documento com dígitos corretos, com ou sem máscara", () => {
    for (const valido of [
      "529.982.247-25", "52998224725", "111.444.777-35",
      "11.222.333/0001-81", "06.125.389/0001-88", "39.519.860/0001-71",
    ]) {
      assert.ok(documentoValido(valido), `deveria aceitar ${valido}`);
    }
  });

  it("recusa dígito verificador errado", () => {
    for (const invalido of ["529.982.247-24", "11.222.333/0001-80", "06125389000187"]) {
      assert.ok(!documentoValido(invalido), `deveria recusar ${invalido}`);
    }
  });

  it("recusa sequência repetida, que passa na conta mas não é de ninguém", () => {
    for (const repetido of ["111.111.111-11", "000.000.000-00", "11.111.111/1111-11"]) {
      assert.ok(!documentoValido(repetido), `deveria recusar ${repetido}`);
    }
  });

  it("recusa tamanho que não é de CPF nem de CNPJ", () => {
    for (const torto of ["123", "1234567890", "123456789012345"]) {
      assert.ok(!documentoValido(torto), `deveria recusar ${torto}`);
    }
  });

  it("normaliza e formata para leitura", () => {
    assert.equal(somenteDigitos("529.982.247-25"), "52998224725");
    assert.equal(formatarDocumento("52998224725"), "529.982.247-25");
    assert.equal(formatarDocumento("06125389000188"), "06.125.389/0001-88");
    assert.equal(formatarDocumento("abc"), "abc");
  });
});
