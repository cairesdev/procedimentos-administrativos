import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aplicarSequencia, espiarColunas, pareceCabecalho, separarCelulas, sugerirSequencia,
} from "../../../web/src/shared/lib/column-mapping";
import {
  CAMPOS_DO_ITEM, converterItensComSequencia, sugerirSequenciaDeItens,
} from "../../../web/src/shared/lib/spreadsheet-paste";
import {
  converterPlanilhaComSequencia, sugerirSequenciaDaEntrada,
} from "../../../web/src/features/stock/paste";

/**
 * Importação com as colunas declaradas pelo usuário.
 *
 * Nasceu de dado entrando trocado: o sistema adivinhava a ordem quando não
 * reconhecia o cabeçalho, e planilha com uma coluna a mais fazia quantidade
 * virar valor — sem erro e sem aviso. O primeiro teste abaixo é exatamente
 * esse caso, e é o que a versão antiga não pegava.
 */

describe("a coluna a mais que estragava a importacao", () => {
  // Planilha real: começa com "item nº", que nenhum dos formatos previa.
  const planilha = [
    "1\tARROZ TIPO 1\tKG\t100\t5,50",
    "2\tFEIJAO CARIOCA\tKG\t50\t8,20",
  ].join("\n");

  it("com a sequencia declarada, cada valor cai no campo certo", () => {
    const { items } = converterItensComSequencia(planilha, [
      null, "produto", "unidadeMedida", "quantidade", "valorUnitario",
    ]);

    assert.equal(items.length, 2);
    assert.equal(items[0]!.produto, "ARROZ TIPO 1");
    assert.equal(items[0]!.unidadeMedida, "KG");
    assert.equal(items[0]!.quantidade, 100);
    assert.equal(items[0]!.valorUnitario, 5.5);
    assert.equal(items[0]!.valorTotal, 550);
  });

  it("a coluna ignorada nao vira campo nenhum", () => {
    const { items } = converterItensComSequencia(planilha, [
      null, "produto", "unidadeMedida", "quantidade", "valorUnitario",
    ]);
    // O "1" da primeira coluna não pode ter virado quantidade nem valor.
    assert.notEqual(items[0]!.quantidade, 1);
    assert.notEqual(items[0]!.valorUnitario, 1);
  });
});

describe("sequencia declarada", () => {
  it("respeita a ordem que o usuario informou, mesmo invertida", () => {
    // Planilha com valor antes de quantidade: existe, e a ordem fixa antiga
    // trocava os dois.
    const texto = "5,50\t100\tARROZ";
    const { items } = converterItensComSequencia(texto, [
      "valorUnitario", "quantidade", "produto",
    ]);

    assert.equal(items[0]!.produto, "ARROZ");
    assert.equal(items[0]!.quantidade, 100);
    assert.equal(items[0]!.valorUnitario, 5.5);
  });

  it("campo repetido usa a primeira ocorrencia, sem sobrescrever", () => {
    const texto = "ARROZ\tFEIJAO\t10";
    const { items } = converterItensComSequencia(texto, ["produto", "produto", "quantidade"]);
    assert.equal(items[0]!.produto, "ARROZ");
  });

  it("linha sem o campo obrigatorio e ignorada e contada", () => {
    // Linha de total no fim da planilha: sem produto, mas com número.
    const texto = ["ARROZ\t10\t5,00", "\t\t50,00"].join("\n");
    const { items, ignoredLines } = converterItensComSequencia(texto, [
      "produto", "quantidade", "valorUnitario",
    ]);

    assert.equal(items.length, 1);
    assert.equal(ignoredLines, 1);
  });

  it("sem coluna de produto apontada, nada entra", () => {
    const { items } = converterItensComSequencia("ARROZ\t10", ["quantidade", null]);
    assert.equal(items.length, 0);
  });
});

describe("cabecalho: descartar sem confundir com dado", () => {
  it("descarta a linha de titulo", () => {
    const texto = ["PRODUTO\tQTD", "ARROZ\t100"].join("\n");
    const { items, hasHeader } = converterItensComSequencia(texto, ["produto", "quantidade"]);

    assert.equal(hasHeader, true);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.produto, "ARROZ");
  });

  it("nao descarta a primeira linha de dado", () => {
    // Sem cabeçalho, a primeira linha é item — perdê-la seria pior que manter
    // um título na tabela, porque ninguém percebe a falta de uma linha.
    const texto = ["ARROZ\t100", "FEIJAO\t50"].join("\n");
    const { items, hasHeader } = converterItensComSequencia(texto, ["produto", "quantidade"]);

    assert.equal(hasHeader, false);
    assert.equal(items.length, 2);
  });

  it("sem campo numerico apontado, nao arrisca descartar nada", () => {
    const celulas = ["PRODUTO", "MARCA"];
    assert.equal(pareceCabecalho(celulas, ["produto", "marca"], []), false);
  });
});

describe("sugestao a partir do cabecalho", () => {
  it("le a ordem real da planilha, nao a ordem padrao", () => {
    const texto = "Valor unitário\tQuantidade\tProduto\nx\t1\ty";
    assert.deepEqual(sugerirSequenciaDeItens(texto), [
      "valorUnitario", "quantidade", "produto",
    ]);
  });

  it("coluna sem correspondente vira ignorar", () => {
    // "Conferido" não é sinônimo de campo nenhum — a coluna existe e não entra.
    const texto = "Produto\tConferido\tQuantidade\nARROZ\tsim\t10";
    assert.deepEqual(sugerirSequenciaDeItens(texto), ["produto", null, "quantidade"]);
  });

  it("\"Item nº\" e lido como produto — e por isso a sugestao pede confirmacao", () => {
    // `item` é sinônimo legítimo de produto: muita planilha escreve "Item" na
    // coluna do material. Numa que o usa como número sequencial, a sugestão
    // erra — e é exatamente por isso que ela é sugestão, com a amostra das
    // primeiras linhas ao lado para o usuário corrigir antes de importar.
    const texto = "Item nº\tProduto\tQuantidade\n1\tARROZ\t10";
    const sugestao = sugerirSequenciaDeItens(texto);

    assert.equal(sugestao![0], "produto");
    // A segunda coluna, que é o produto de verdade, sai como ignorar: o campo
    // já foi consumido pela primeira.
    assert.equal(sugestao![1], null);
  });

  it("uma coincidencia so nao vira sugestao", () => {
    // "MATERIAL DE LIMPEZA" casaria com o sinônimo "material" e faria o
    // sistema propor uma sequência a partir de uma linha de dado.
    const texto = "MATERIAL DE LIMPEZA\t10\t5,00";
    assert.equal(sugerirSequenciaDeItens(texto), null);
  });

  it("planilha da entrada de estoque tambem sugere", () => {
    const texto = "Produto\tUnidade\tQuantidade\tValidade\nARROZ\tKG\t10\t31/12/2026";
    assert.deepEqual(sugerirSequenciaDaEntrada(texto), [
      "nome", "unidade", "quantidade", "dataValidade",
    ]);
  });
});

describe("entrada de estoque com sequencia", () => {
  it("converte data em qualquer um dos dois formatos", () => {
    const texto = ["ARROZ\tKG\t10\t31/12/2026", "FEIJAO\tKG\t5\t2026-11-30"].join("\n");
    const { linhas } = converterPlanilhaComSequencia(texto, [
      "nome", "unidade", "quantidade", "dataValidade",
    ]);

    assert.equal(linhas[0]!.dataValidade, "2026-12-31");
    assert.equal(linhas[1]!.dataValidade, "2026-11-30");
  });

  it("conta a data que nao entendeu, em vez de gravar validade errada", () => {
    const texto = "ARROZ\tKG\t10\tsem data";
    const { datasInvalidas, linhas } = converterPlanilhaComSequencia(texto, [
      "nome", "unidade", "quantidade", "dataValidade",
    ]);

    assert.equal(datasInvalidas, 1);
    assert.equal(linhas[0]!.dataValidade, null);
  });

  it("produto sem quantidade nao entra com zero", () => {
    // Linha de seção ("HORTIFRUTI") no meio da planilha: tem nome e não tem
    // quantidade. Entrar com zero criaria lote fantasma.
    const texto = ["HORTIFRUTI\t\t\t", "ALFACE\tUN\t20\t"].join("\n");
    const { linhas, ignoradas } = converterPlanilhaComSequencia(texto, [
      "nome", "unidade", "quantidade", "dataValidade",
    ]);

    assert.equal(linhas.length, 1);
    assert.equal(linhas[0]!.nome, "ALFACE");
    assert.equal(ignoradas, 1);
  });

  it("unidade em branco vira UN", () => {
    const { linhas } = converterPlanilhaComSequencia("ARROZ\t\t10", [
      "nome", "unidade", "quantidade",
    ]);
    assert.equal(linhas[0]!.unidade, "UN");
  });
});

describe("separacao das celulas", () => {
  it("tabulacao vence, que e o que o Excel cola", () => {
    assert.deepEqual(separarCelulas("a\tb;c"), ["a", "b;c"]);
  });

  it("ponto e virgula e barra servem ao CSV exportado", () => {
    assert.deepEqual(separarCelulas("a;b;c"), ["a", "b", "c"]);
    assert.deepEqual(separarCelulas("a|b"), ["a", "b"]);
  });

  it("virgula NAO separa: e decimal em planilha brasileira", () => {
    // Dividir por vírgula partiria "1.234,56" ao meio.
    assert.deepEqual(separarCelulas("1.234,56"), ["1.234,56"]);
  });
});

describe("espiar as colunas para a tela", () => {
  it("devolve as primeiras linhas ja separadas", () => {
    const texto = ["a\tb", "c\td", "e\tf", "g\th", "i\tj"].join("\n");
    const amostra = espiarColunas(texto, 3);

    assert.equal(amostra.length, 3);
    assert.deepEqual(amostra[0], ["a", "b"]);
  });

  it("texto vazio nao quebra", () => {
    assert.deepEqual(espiarColunas(""), []);
    assert.deepEqual(aplicarSequencia("", ["produto"], { obrigatorio: "produto" }).linhas, []);
  });
});

describe("o catalogo de campos oferecido na tela", () => {
  it("cobre todos os campos do item", () => {
    // Campo que existe no tipo e não aparece na lista seria impossível de
    // apontar — e o usuário concluiria que o sistema não o importa.
    const oferecidos = CAMPOS_DO_ITEM.map((item) => item.campo).sort();
    assert.deepEqual(oferecidos, [
      "descricao", "marca", "produto", "quantidade",
      "unidadeMedida", "valorTotal", "valorUnitario",
    ]);
  });

  it("toda escolha tem um rotulo legivel", () => {
    for (const item of CAMPOS_DO_ITEM) {
      assert.ok(item.rotulo.length > 2, `${item.campo} sem rótulo`);
      assert.ok(!/[a-z][A-Z]/.test(item.rotulo), `${item.rotulo} parece nome de variável`);
    }
  });
});

describe("sugerirSequencia generico", () => {
  it("nao repete o mesmo campo em duas colunas", () => {
    // "Produto" e "Item" são sinônimos do mesmo campo; a segunda coluna tem de
    // sair como ignorar, e não sobrescrever a primeira.
    const texto = "Produto\tItem\tQuantidade\nx\ty\t1";
    const sequencia = sugerirSequencia(texto, {
      produto: ["produto", "item"],
      quantidade: ["quantidade"],
    });
    assert.deepEqual(sequencia, ["produto", null, "quantidade"]);
  });
});
