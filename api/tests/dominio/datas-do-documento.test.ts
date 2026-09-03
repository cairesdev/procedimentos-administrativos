import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dataDoDocumento } from "../../src/domain/documento/Datas";

/**
 * O dia do calendário que virava o dia anterior.
 *
 * A formatação passava tudo por `new Date()` e convertia para o horário de
 * Brasília. Para um `TIMESTAMPTZ` isso está certo — é um instante, e o instante
 * tem fuso. Para um `DATE` está errado: `2026-01-01` é o primeiro de janeiro em
 * qualquer lugar do mundo, mas `new Date("2026-01-01")` é meia-noite **UTC**,
 * que em São Paulo é 21h do dia 31.
 *
 * O relatório saía com "31/12/2025 a 29/06/2026" onde devia estar 01/01 a
 * 30/06, e a validade dos lotes nas peças do almoxarifado vinha sempre um dia
 * a menos — num documento que o conselho de alimentação escolar assina.
 */
describe("data num documento emitido", () => {
  it("o dia do calendário sai como está, sem fuso no caminho", () => {
    assert.equal(dataDoDocumento("2026-01-01"), "01/01/2026");
    assert.equal(dataDoDocumento("2026-06-30"), "30/06/2026");
    assert.equal(dataDoDocumento("2025-12-31"), "31/12/2025");
  });

  it("o primeiro dia do ano não retrocede para o ano anterior", () => {
    // O caso que apareceu no relatório: 01/01 virava 31/12 do ano passado, e o
    // período impresso contradizia o que o usuário havia pedido.
    for (const ano of [2024, 2025, 2026, 2027]) {
      assert.equal(dataDoDocumento(`${ano}-01-01`), `01/01/${ano}`);
    }
  });

  it("instante continua convertido para o horário de Brasília", () => {
    // `TIMESTAMPTZ` é outra coisa: aí o fuso importa, e a peça deve mostrar a
    // hora local. Meia-noite UTC é o dia anterior às 21h em São Paulo.
    assert.equal(dataDoDocumento(new Date("2026-01-01T00:00:00Z")), "31/12/2025");
    assert.equal(dataDoDocumento(new Date("2026-01-01T12:00:00Z")), "01/01/2026");
  });

  it("data com hora junto conta como instante", () => {
    // O que vem de um `TIMESTAMPTZ` em texto — não é dia de calendário.
    assert.equal(dataDoDocumento("2026-01-01T12:00:00Z"), "01/01/2026");
  });

  it("texto que não é data vira traço, e não derruba a emissão", () => {
    // `Intl` lança `RangeError` diante de data inválida — e uma exceção aqui
    // levaria junto a peça inteira por causa de um campo. O traço é o mesmo que
    // o resto do sistema usa para ausência.
    assert.equal(dataDoDocumento("sem validade"), "—");
    assert.equal(dataDoDocumento(null), "—");
    assert.equal(dataDoDocumento(undefined), "—");
    assert.equal(dataDoDocumento(new Date("nada")), "—");
  });
});
