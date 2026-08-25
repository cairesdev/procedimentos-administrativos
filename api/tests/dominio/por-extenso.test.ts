import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dataPorExtenso, numeroPorExtenso, valorPorExtenso,
} from "../../src/domain/documento/PorExtenso";

describe("valor por extenso", () => {
  it("escreve os casos que aparecem nas ordens do legado", () => {
    const casos: [number, string][] = [
      [0, "zero reais"],
      [1, "um real"],
      [0.01, "um centavo"],
      [1.01, "um real e um centavo"],
      [100, "cem reais"],
      [101, "cento e um reais"],
      [1000, "mil reais"],
      [1015, "mil e quinze reais"],
      [1100, "mil e cem reais"],
      [2000, "dois mil reais"],
      // Valor real da Ordem de Compras de São Bernardo.
      [18401.14, "dezoito mil, quatrocentos e um reais e quatorze centavos"],
      // Valor real da Ordem de Serviço de Alto Parnaíba.
      [59750, "cinquenta e nove mil, setecentos e cinquenta reais"],
      [1000000, "um milhão de reais"],
      [2000000, "dois milhões de reais"],
      [1500000, "um milhão e quinhentos mil reais"],
    ];
    for (const [valor, esperado] of casos) {
      assert.equal(valorPorExtenso(valor), esperado, `falhou em ${valor}`);
    }
  });

  it("arredonda em centavos antes de separar", () => {
    // Em ponto flutuante, 0.1 + 0.2 = 0.30000000000000004. Truncar em vez de
    // arredondar escreveria "vinte e nove centavos" no documento oficial.
    assert.equal(valorPorExtenso(0.1 + 0.2), "trinta centavos");
    assert.equal(valorPorExtenso(1243.8), "mil, duzentos e quarenta e três reais e oitenta centavos");
  });

  it("aceita valor negativo", () => {
    assert.equal(valorPorExtenso(-5.5), "menos cinco reais e cinquenta centavos");
  });

  it("escreve inteiro sem unidade monetária", () => {
    assert.equal(numeroPorExtenso(0), "zero");
    assert.equal(numeroPorExtenso(15), "quinze");
    assert.equal(numeroPorExtenso(1000), "mil");
  });
});

describe("data por extenso", () => {
  it("usa o fuso do município, não o do servidor", () => {
    // Em container rodando UTC, 02h do dia 25 ainda é dia 24 no Brasil. Sem
    // fuso fixo, o documento viraria o dia às 21h.
    const antesDaMeiaNoite = new Date("2026-08-25T02:00:00Z");
    assert.equal(dataPorExtenso(antesDaMeiaNoite), "segunda-feira, 24 de agosto de 2026");
  });

  it("escreve como o legado imprime", () => {
    const momento = new Date("2026-08-24T15:00:00Z");
    assert.equal(dataPorExtenso(momento), "segunda-feira, 24 de agosto de 2026");
    assert.equal(
      dataPorExtenso(momento, { comDiaDaSemana: false }),
      "24 de agosto de 2026",
    );
  });
});
