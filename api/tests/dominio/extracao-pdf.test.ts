import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extrairBloco, extrairDoPdf, removerCabecalho, separarItens, type FieldSpec,
} from "../../../web/src/shared/lib/pdf-paste";
import { converterItensDoPdf } from "../../../web/src/shared/lib/spreadsheet-paste";

/**
 * Colagem de PDF.
 *
 * Os dois textos abaixo são reais, trazidos por quem usa o sistema. O primeiro
 * é um termo de referência de contratação de serviço; o segundo, uma planilha
 * orçamentária de obra com códigos SINAPI e ORSE. Nos dois, o PDF entregou a
 * tabela inteira como um parágrafo só — sem tabulação e sem quebra de linha.
 */

const TERMO_DE_REFERENCIA =
  "ITEM ESPECIFICAÇÃO UND QTD VALOR UNIT (RS) VALOR TOTAL- (R$) 1 Contratação de "
  + "Empresa Especializada na Prestação de Serviços Técnicos de Assessoria e "
  + "Consultoria, bem como o fornecimento, implantação, migração de dados, "
  + "manutenção e suporte de sistema informatizado de gestão de Folha de Pagamento, "
  + "incluindo aplicativo (APP), destinado à Administração Pública Municipal, "
  + "contemplando suporte técnico especializado presencial e in loco, em "
  + "conformidade com as normas e exigências do Tribunal de Contas do Estado do "
  + "Maranhão (TCE/MA), visando atender às necessidades operacionais do Município "
  + "de São Roberto/MA 12 Mês R$ 6.000,00 R$ 72.000,00";

const ORCAMENTO_DE_OBRA =
  "ITEM CÓDIGO DESCRIÇÃO FONTE UNIDADE QTD CUSTO DIRETO (R$) PREÇO UNITÁRIO (R$) "
  + "PREÇO COM DESCONTO APLICADO (16,70%) UNITÁRIO (R$) PREÇO TOTAL (R$) MÃO DE OBRA "
  + "MATERIAL BDI 1 SERVIÇOS PRELIMINARES 6.263,65 1.1 103689 FORNECIMENTO E "
  + "INSTALAÇÃO DE PLACA DE OBRA COM CHAPA GALVANIZADA E ESTRUTURA DE MADEIRA. "
  + "AF_03/2022_PS SINAPI M2 6,00 31,96 466,24 118,27 616,47 513,52 3.081,12 "
  + "1.2 I12333 MOBILIZAÇÃO E DESMOBILIZAÇÃO DE OBRA EM CENTRO URBANO OU REGIÃO "
  + "LIMÍTROFE COM VALOR ENTRE 1.000.000,01 E 3.000.000,00 (0,30%) ORSE Un 1,00 "
  + "0,00 3.087,57 732,99 3.820,56 3.182,53 3.182,53 2 COBERTURA 35.242,72 "
  + "2.1 92539 TRAMA DE MADEIRA COMPOSTA POR RIPAS, CAIBROS E TERÇAS PARA TELHADOS "
  + "DE ATÉ 2 ÁGUAS SINAPI M2 220,00 23,78 78,63 24,31 126,72 105,56 23.223,20";

const SEQUENCIA_DO_TERMO: FieldSpec<string>[] = [
  { campo: "numeracao", rotulo: "Nº", tipo: "numero" },
  { campo: "produto", rotulo: "Especificação", tipo: "texto" },
  { campo: "quantidade", rotulo: "Qtd", tipo: "numero" },
  { campo: "unidadeMedida", rotulo: "Unidade", tipo: "palavra" },
  { campo: "valorUnitario", rotulo: "Unitário", tipo: "numero" },
  { campo: "valorTotal", rotulo: "Total", tipo: "numero" },
];

const SEQUENCIA_DA_OBRA: FieldSpec<string>[] = [
  { campo: "numeracao", rotulo: "Nº", tipo: "numero" },
  { campo: "codigo", rotulo: "Código", tipo: "palavra" },
  { campo: "produto", rotulo: "Descrição", tipo: "texto" },
  { campo: "fonte", rotulo: "Fonte", tipo: "palavra" },
  { campo: "unidadeMedida", rotulo: "Unidade", tipo: "palavra" },
  { campo: "quantidade", rotulo: "Qtd", tipo: "numero" },
  { campo: "custoDireto", rotulo: "Custo", tipo: "numero" },
  { campo: "precoUnitario", rotulo: "Preço unit.", tipo: "numero" },
  { campo: "bdi", rotulo: "BDI", tipo: "numero" },
  { campo: "comDesconto", rotulo: "Com desconto", tipo: "numero" },
  { campo: "valorUnitario", rotulo: "Unitário final", tipo: "numero" },
  { campo: "valorTotal", rotulo: "Total", tipo: "numero" },
];

describe("termo de referência: um item, descrição longa", () => {
  const limpo = removerCabecalho(TERMO_DE_REFERENCIA, [
    "ITEM", "ESPECIFICAÇÃO", "UND", "QTD", "VALOR UNIT", "VALOR TOTAL",
  ]);

  it("corta o cabeçalho grudado no primeiro item", () => {
    assert.ok(limpo.startsWith("1 Contratação"), `começou com: ${limpo.slice(0, 40)}`);
  });

  it("extrai os valores das pontas e o texto do meio", () => {
    const { linhas } = extrairDoPdf(limpo, SEQUENCIA_DO_TERMO);
    assert.equal(linhas.length, 1);

    const item = linhas[0]!;
    assert.equal(item.numeracao, "1");
    assert.equal(item.quantidade, "12");
    assert.equal(item.unidadeMedida, "Mês");
    assert.equal(item.valorUnitario, "6.000,00");
    assert.equal(item.valorTotal, "72.000,00");
  });

  it("a especificação inteira vai para o texto, sem cortar no meio", () => {
    const { linhas } = extrairDoPdf(limpo, SEQUENCIA_DO_TERMO);
    const produto = linhas[0]!.produto!;

    assert.ok(produto.startsWith("Contratação de Empresa"));
    assert.ok(produto.endsWith("São Roberto/MA"), `terminou com: ${produto.slice(-40)}`);
    // Os números do fim não podem ter sobrado dentro do texto.
    assert.ok(!produto.includes("72.000,00"));
    assert.ok(!produto.includes("6.000,00"));
  });

  it("a ordem declarada vence o cabeçalho, que estava invertido", () => {
    // O título diz "UND QTD"; o dado vem "12 Mês". Adivinhar pelo cabeçalho
    // gravaria a unidade como quantidade.
    const { linhas } = extrairDoPdf(limpo, SEQUENCIA_DO_TERMO);
    assert.equal(linhas[0]!.quantidade, "12");
    assert.notEqual(linhas[0]!.quantidade, "Mês");
  });

  it("R$ é ruído e não vira token", () => {
    const { items } = converterItensDoPdf(TERMO_DE_REFERENCIA, SEQUENCIA_DO_TERMO);
    assert.equal(items[0]!.valorUnitario, 6000);
    assert.equal(items[0]!.valorTotal, 72000);
    assert.equal(items[0]!.quantidade, 12);
  });
});

describe("orçamento de obra: vários itens e linhas de seção", () => {
  const limpo = removerCabecalho(ORCAMENTO_DE_OBRA, [
    "ITEM", "CÓDIGO", "DESCRIÇÃO", "FONTE", "UNIDADE", "QTD",
    "MÃO DE OBRA", "MATERIAL", "BDI",
  ]);

  it("separa um bloco por item, sem partir a descrição", () => {
    const blocos = separarItens(limpo);
    // 1 (seção), 1.1, 1.2, 2 (seção), 2.1
    assert.equal(blocos.length, 5);
  });

  it('"ATÉ 2 ÁGUAS" não abre um item novo', () => {
    // Um número seguido de texto no meio da descrição partiria o item em dois
    // se o corte olhasse só a numeração.
    const blocos = separarItens(limpo);
    const trama = blocos.find((bloco) => bloco.includes("TRAMA DE MADEIRA"));

    assert.ok(trama, "o item 2.1 sumiu");
    assert.ok(trama!.includes("ATÉ 2 ÁGUAS"), "a descrição foi partida");
    assert.ok(trama!.includes("23.223,20"), "o total do item ficou noutro bloco");
  });

  it('"1.000.000,01" na descrição não abre item', () => {
    const blocos = separarItens(limpo);
    const mobilizacao = blocos.find((bloco) => bloco.includes("MOBILIZAÇÃO"));

    assert.ok(mobilizacao!.includes("1.000.000,01 E 3.000.000,00"));
    assert.ok(mobilizacao!.includes("3.182,53"));
  });

  it("extrai os três serviços e descarta as duas seções", () => {
    // "1 SERVIÇOS PRELIMINARES 6.263,65" é subtotal do grupo, não item: tem um
    // número só, e a sequência pede sete. Importá-lo somaria o mesmo dinheiro
    // duas vezes no total do contrato.
    const { linhas, descartados } = extrairDoPdf(limpo, SEQUENCIA_DA_OBRA);

    assert.equal(linhas.length, 3);
    assert.equal(descartados, 2);
    assert.deepEqual(linhas.map((linha) => linha.numeracao), ["1.1", "1.2", "2.1"]);
  });

  it("cada campo cai no lugar certo, do código ao total", () => {
    const { linhas } = extrairDoPdf(limpo, SEQUENCIA_DA_OBRA);
    const placa = linhas[0]!;

    assert.equal(placa.codigo, "103689");
    assert.equal(placa.fonte, "SINAPI");
    assert.equal(placa.unidadeMedida, "M2");
    assert.equal(placa.quantidade, "6,00");
    assert.equal(placa.valorTotal, "3.081,12");
    assert.ok(placa.produto!.startsWith("FORNECIMENTO E INSTALAÇÃO"));
  });

  it("código com letra também é lido", () => {
    const { linhas } = extrairDoPdf(limpo, SEQUENCIA_DA_OBRA);
    assert.equal(linhas[1]!.codigo, "I12333");
    assert.equal(linhas[1]!.fonte, "ORSE");
  });

  it("o rastro do orçamento vai para a descrição", () => {
    // Número do item, fonte e código não têm coluna no contrato, e jogá-los
    // fora perderia a ligação com a planilha orçamentária aprovada.
    const { items } = converterItensDoPdf(ORCAMENTO_DE_OBRA, SEQUENCIA_DA_OBRA);
    assert.match(items[0]!.descricao, /1\.1/);
    assert.match(items[0]!.descricao, /SINAPI/);
    assert.match(items[0]!.descricao, /103689/);
  });

  it("o produto respeita o limite de 150 caracteres da coluna", () => {
    const { items } = converterItensDoPdf(ORCAMENTO_DE_OBRA, SEQUENCIA_DA_OBRA);
    for (const item of items) {
      assert.ok(item.produto.length <= 150, `produto com ${item.produto.length}`);
    }
  });
});

describe("o que engana o extrator", () => {
  it("bloco sem números suficientes é descartado, não meio-preenchido", () => {
    // Meio-preenchido é pior que ausente: entra na tabela com valor zero e
    // ninguém percebe até somar o contrato.
    const resultado = extrairBloco("2 COBERTURA 35.242,72", SEQUENCIA_DA_OBRA);
    assert.equal(resultado, null);
  });

  it("falta de número no meio do bloco descarta a linha inteira", () => {
    // Aqui o texto NÃO fica vazio, então a guarda do meio não pega: sem o
    // corte explícito, o item entraria com um campo `undefined` — e um valor
    // ausente que parece preenchido é pior que a linha faltando.
    const sequencia: FieldSpec<string>[] = [
      { campo: "produto", rotulo: "Produto", tipo: "texto" },
      { campo: "valorUnitario", rotulo: "Unitário", tipo: "numero" },
      { campo: "valorTotal", rotulo: "Total", tipo: "numero" },
    ];

    assert.equal(extrairBloco("ALGUMA COISA 10", sequencia), null);
  });

  it("texto vazio devolve lista vazia", () => {
    assert.deepEqual(extrairDoPdf("", SEQUENCIA_DO_TERMO).linhas, []);
    assert.deepEqual(separarItens(""), []);
  });

  it("sequência vazia não inventa item", () => {
    assert.deepEqual(extrairDoPdf(TERMO_DE_REFERENCIA, []).linhas, []);
  });

  it("sem campo de texto, cada posição consome um token", () => {
    const sequencia: FieldSpec<string>[] = [
      { campo: "codigo", rotulo: "Código", tipo: "palavra" },
      { campo: "quantidade", rotulo: "Qtd", tipo: "numero" },
    ];
    const resultado = extrairBloco("ABC 10", sequencia);
    assert.deepEqual(resultado, { codigo: "ABC", quantidade: "10" });
  });

  it("texto já quebrado em linhas usa as linhas, que são mais confiáveis", () => {
    const texto = ["1 ARROZ 10 KG 5,00 50,00", "2 FEIJAO 5 KG 8,00 40,00"].join("\n");
    assert.equal(separarItens(texto).length, 2);
  });

  it("cabeçalho sem rótulo conhecido não corta nada", () => {
    // Cortar por engano comeria o primeiro item — e a falta de uma linha é
    // muito mais difícil de notar que uma linha a mais.
    const texto = "1 ALGUMA COISA 10 UN 5,00 50,00";
    assert.equal(removerCabecalho(texto, ["INEXISTENTE"]), texto);
  });
});
