import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTERVALO_PADRAO_MS, LOTE_PADRAO, intervaloDoAmbiente, loteDoAmbiente,
} from "../../src/domain/email/RitmoDoWorker";

describe("o ritmo do worker de e-mail", () => {
  it("sem variável, usa o padrão de 15 segundos", () => {
    assert.deepEqual(intervaloDoAmbiente(undefined), { valor: INTERVALO_PADRAO_MS });
    assert.deepEqual(loteDoAmbiente(undefined), { valor: LOTE_PADRAO });
  });

  it("valor válido passa como veio", () => {
    assert.equal(intervaloDoAmbiente("30000").valor, 30_000);
    assert.equal(loteDoAmbiente("50").valor, 50);
  });

  it("\"15s\" não vira laço quente", () => {
    /**
     * O defeito que este arquivo existe para impedir.
     *
     * `Number("15s")` é `NaN`, e `setTimeout(fn, NaN)` **dispara na hora**: o
     * worker viraria um laço martelando o Postgres, sem erro nenhum no log. É
     * o erro natural de quem escreve "15 segundos" no `.env`, e o custo
     * apareceria só na conta de CPU da VPS.
     */
    const resultado = intervaloDoAmbiente("15s");
    assert.equal(resultado.valor, INTERVALO_PADRAO_MS);
    assert.match(resultado.aviso ?? "", /não é um número/);

    for (const ruim of ["", "   ", "abc", "1,5", "um minuto"]) {
      assert.ok(
        Number.isFinite(intervaloDoAmbiente(ruim).valor)
        && intervaloDoAmbiente(ruim).valor >= 5_000,
        `"${ruim}" produziu intervalo inutilizável`,
      );
    }
  });

  it("valor pequeno demais vira o piso, e avisa", () => {
    // Abaixo de 5s o ganho é imperceptível para quem recebe e o custo deixa de
    // ser. Quem quer instantâneo precisa de LISTEN/NOTIFY.
    const resultado = intervaloDoAmbiente("100");
    assert.equal(resultado.valor, 5_000);
    assert.match(resultado.aviso ?? "", /mínimo/);

    assert.equal(intervaloDoAmbiente("0").valor, 5_000);
    assert.equal(intervaloDoAmbiente("-9000").valor, 5_000);
  });

  it("valor absurdo vira o teto, e avisa", () => {
    const resultado = intervaloDoAmbiente("999999999");
    assert.equal(resultado.valor, 3_600_000);
    assert.match(resultado.aviso ?? "", /máximo/);
  });

  it("o lote nunca é zero", () => {
    // Lote zero faria o worker rodar para sempre sem pegar nada — fila parada
    // com o processo vivo, que é o pior dos mundos para diagnosticar.
    assert.equal(loteDoAmbiente("0").valor, 1);
    assert.equal(loteDoAmbiente("-5").valor, 1);
    assert.equal(loteDoAmbiente("9999").valor, 200);
  });

  it("todo valor corrigido vem com aviso", () => {
    // Corrigir em silêncio faria o worker rodar num ritmo que ninguém pediu.
    for (const bruto of ["abc", "0", "999999999"]) {
      assert.ok(intervaloDoAmbiente(bruto).aviso, `"${bruto}" foi corrigido sem avisar`);
    }
    // E o caminho feliz não polui o log.
    assert.equal(intervaloDoAmbiente("20000").aviso, undefined);
  });
});
