import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { converterData, converterPlanilha } from "../../../web/src/features/stock/paste";

/**
 * O conversor da planilha de entrada mora no web, mas o teste vive aqui: é
 * lógica pura, e é onde o dado do mundo real chega mais bagunçado — planilha
 * de prefeitura vem com cabeçalho em maiúscula, data em dois formatos, linha
 * de total no fim e coluna a mais no meio.
 *
 * Errar aqui grava validade errada num lote de merenda, e ninguém percebe
 * até o dia em que o arroz vence.
 */

describe("data da planilha", () => {
  it("aceita os dois formatos que aparecem na prática", () => {
    assert.deepEqual(converterData("2026-12-31"), { data: "2026-12-31", invalida: false });
    assert.deepEqual(converterData("31/12/2026"), { data: "2026-12-31", invalida: false });
    assert.deepEqual(converterData("31-12-2026"), { data: "2026-12-31", invalida: false });
  });

  it("completa o ano de dois dígitos", () => {
    assert.equal(converterData("05/03/26").data, "2026-03-05");
  });

  it("preenche zero à esquerda", () => {
    assert.equal(converterData("5/3/2026").data, "2026-03-05");
  });

  it("célula vazia não é erro", () => {
    // Material de expediente não vence: validade em branco é normal.
    assert.deepEqual(converterData(""), { data: null, invalida: false });
    assert.deepEqual(converterData("   "), { data: null, invalida: false });
  });

  it("data impossível é descartada e contada", () => {
    // Melhor perder a validade e avisar que gravar 31 de fevereiro.
    assert.deepEqual(converterData("31/02/2026"), { data: null, invalida: true });
    assert.deepEqual(converterData("qualquer coisa"), { data: null, invalida: true });
  });
});

describe("colagem da planilha", () => {
  it("reconhece o cabeçalho e lê as linhas", () => {
    const { linhas, temCabecalho } = converterPlanilha(
      [
        "NOME\tUNIDADE\tQUANTIDADE\tDATA_VALIDADE",
        "Arroz tipo 1\tKG\t500\t31/12/2026",
        "Feijão carioca\tKG\t300\t30/06/2026",
      ].join("\n"),
    );

    assert.equal(temCabecalho, true);
    assert.deepEqual(linhas, [
      { nome: "ARROZ TIPO 1", unidade: "KG", quantidade: 500, dataValidade: "2026-12-31" },
      { nome: "FEIJÃO CARIOCA", unidade: "KG", quantidade: 300, dataValidade: "2026-06-30" },
    ]);
  });

  it("aceita as variações de cabeçalho que as prefeituras usam", () => {
    const { linhas } = converterPlanilha(
      ["Produto;Und;Qtde;Vencimento", "Óleo de soja;LT;120;2027-01-15"].join("\n"),
    );
    assert.deepEqual(linhas, [
      { nome: "ÓLEO DE SOJA", unidade: "LT", quantidade: 120, dataValidade: "2027-01-15" },
    ]);
  });

  it("sem cabeçalho, assume a ordem do sistema legado", () => {
    const { linhas, temCabecalho } = converterPlanilha("Açúcar\tKG\t80\t01/12/2026");
    assert.equal(temCabecalho, false);
    assert.deepEqual(linhas, [
      { nome: "AÇÚCAR", unidade: "KG", quantidade: 80, dataValidade: "2026-12-01" },
    ]);
  });

  it("número brasileiro: 4.000 é quatro mil e 2,5 é dois e meio", () => {
    // Quantidade decimal é o motivo de a coluna ser NUMERIC e não integer —
    // o legado usava inteiro e não representava 2,5 kg.
    const { linhas } = converterPlanilha(
      ["NOME\tUNIDADE\tQUANTIDADE", "Arroz\tKG\t4.000", "Sal\tKG\t2,5"].join("\n"),
    );
    assert.equal(linhas[0]!.quantidade, 4000);
    assert.equal(linhas[1]!.quantidade, 2.5);
  });

  it("ignora linha de total e separador que vêm na cópia", () => {
    const { linhas, ignoradas } = converterPlanilha(
      [
        "NOME\tUNIDADE\tQUANTIDADE",
        "Arroz\tKG\t10",
        "\t\t",
        "TOTAL\t\t",
        "Feijão\tKG\t5",
      ].join("\n"),
    );

    assert.deepEqual(linhas.map((linha) => linha.nome), ["ARROZ", "FEIJÃO"]);

    // Só a linha "TOTAL" conta como ignorada: a linha em branco sai antes,
    // no descarte de vazios. Contá-la assustaria quem colou uma planilha
    // normal, que quase sempre tem uma linha vazia no meio.
    assert.equal(ignoradas, 1);
  });

  it("quantidade zero ou negativa não é entrada", () => {
    const { linhas, ignoradas } = converterPlanilha(
      ["NOME\tUNIDADE\tQUANTIDADE", "Arroz\tKG\t0", "Feijão\tKG\t-5"].join("\n"),
    );
    assert.deepEqual(linhas, []);
    assert.equal(ignoradas, 2);
  });

  it("conta as datas que não entendeu, em vez de sumir com elas", () => {
    // A tela avisa; gravar validade em branco sem dizer nada seria pior.
    const { linhas, datasInvalidas } = converterPlanilha(
      ["NOME\tUNIDADE\tQUANTIDADE\tVALIDADE", "Arroz\tKG\t10\tdezembro"].join("\n"),
    );
    assert.equal(datasInvalidas, 1);
    assert.equal(linhas[0]!.dataValidade, null);
  });

  it("sem unidade, assume UN", () => {
    const { linhas } = converterPlanilha(["NOME\tQUANTIDADE", "Caneta\t50"].join("\n"));
    assert.equal(linhas[0]!.unidade, "UN");
  });

  it("normaliza o nome para o catálogo global não duplicar", () => {
    // "arroz tipo 1" e "ARROZ TIPO 1" são o mesmo produto entre prefeituras.
    const { linhas } = converterPlanilha("arroz tipo 1\tkg\t10\t");
    assert.equal(linhas[0]!.nome, "ARROZ TIPO 1");
    assert.equal(linhas[0]!.unidade, "KG");
  });

  it("texto vazio não quebra", () => {
    assert.deepEqual(converterPlanilha(""), {
      linhas: [], ignoradas: 0, temCabecalho: false, datasInvalidas: 0,
    });
  });
});
