import {
  aplicarSequencia, sugerirSequencia, type ColumnChoice,
} from "./column-mapping";
import { extrairDoPdf, removerCabecalho, type FieldSpec } from "./pdf-paste";

export type PastedItem = {
  produto: string;
  descricao: string;
  unidadeMedida: string;
  marca: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type PasteResult = {
  items: PastedItem[];
  ignoredLines: number;
  hasHeader: boolean;
  columns: string[];
};

/** Campos que o usuário pode apontar ao colar, na ordem em que a tela os oferece. */
export const CAMPOS_DO_ITEM: { campo: keyof PastedItem; rotulo: string }[] = [
  { campo: "produto", rotulo: "Produto" },
  { campo: "descricao", rotulo: "Descrição" },
  { campo: "unidadeMedida", rotulo: "Unidade" },
  { campo: "marca", rotulo: "Marca" },
  { campo: "quantidade", rotulo: "Quantidade" },
  { campo: "valorUnitario", rotulo: "Valor unitário" },
  { campo: "valorTotal", rotulo: "Valor total" },
];

const NUMERICOS: (keyof PastedItem)[] = ["quantidade", "valorUnitario", "valorTotal"];

// Sinônimos aceitos no cabeçalho — as planilhas das prefeituras variam muito.
const COLUMN_ALIASES: Record<keyof PastedItem, string[]> = {
  produto: ["produto", "item", "nome", "material", "especificacao", "descricao do item"],
  descricao: ["descricao", "detalhamento", "detalhe", "observacao", "complemento"],
  unidadeMedida: ["unidade", "und", "un", "unid", "medida", "unidade de medida"],
  marca: ["marca", "fabricante"],
  quantidade: ["quantidade", "qtd", "qtde", "quant", "qtd total"],
  valorUnitario: ["valor unitario", "vlr unitario", "preco unitario", "unitario", "preco", "valor unit"],
  valorTotal: ["valor total", "vlr total", "total", "preco total", "valor"],
};

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Planilha brasileira: "4.000" é quatro mil, "6,00" é seis.
// Só trata o ponto como decimal quando não forma grupos de milhar.
export const parseNumber = (value: string): number => {
  const cleaned = value.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const looksLikeThousands = /^-?\d{1,3}(\.\d{3})+$/.test(cleaned);

  const normalized =
    hasComma || looksLikeThousands
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const splitLine = (line: string): string[] =>
  line.includes("\t") ? line.split("\t") : line.split(/[;|]/);

const detectHeader = (cells: string[]): Partial<Record<keyof PastedItem, number>> | null => {
  const mapping: Partial<Record<keyof PastedItem, number>> = {};

  cells.forEach((cell, index) => {
    const label = normalize(cell);
    if (!label) return;
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
      keyof PastedItem,
      string[],
    ][]) {
      if (mapping[field] !== undefined) continue;
      if (aliases.some((alias) => label === alias || label.startsWith(`${alias} `))) {
        mapping[field] = index;
        return;
      }
    }
  });

  // Exige ao menos produto e quantidade para tratar a linha como cabeçalho.
  return mapping.produto !== undefined && mapping.quantidade !== undefined ? mapping : null;
};

// Sem cabeçalho: assume a ordem mais comum das planilhas recebidas.
const POSITIONAL: (keyof PastedItem)[] = [
  "produto",
  "descricao",
  "unidadeMedida",
  "quantidade",
  "marca",
  "valorUnitario",
  "valorTotal",
];

export const parsePastedItems = (text: string): PasteResult => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { items: [], ignoredLines: 0, hasHeader: false, columns: [] };
  }

  const headerCells = splitLine(lines[0]!);
  const mapping = detectHeader(headerCells);
  const rows = mapping ? lines.slice(1) : lines;

  const at = (cells: string[], field: keyof PastedItem): string => {
    const index = mapping ? mapping[field] : POSITIONAL.indexOf(field);
    if (index === undefined || index < 0) return "";
    return (cells[index] ?? "").trim();
  };

  let ignoredLines = 0;
  const items: PastedItem[] = [];

  for (const line of rows) {
    const cells = splitLine(line);
    const produto = at(cells, "produto");
    if (!produto) {
      ignoredLines += 1;
      continue;
    }

    const quantidade = parseNumber(at(cells, "quantidade"));
    const valorUnitario = parseNumber(at(cells, "valorUnitario"));
    const valorTotalCelula = parseNumber(at(cells, "valorTotal"));

    const valorTotal = valorTotalCelula || quantidade * valorUnitario;
    const unitario = valorUnitario || (quantidade > 0 ? valorTotal / quantidade : 0);

    items.push({
      produto,
      descricao: at(cells, "descricao"),
      unidadeMedida: at(cells, "unidadeMedida") || "UN",
      marca: at(cells, "marca"),
      quantidade,
      valorUnitario: Number(unitario.toFixed(4)),
      valorTotal: Number(valorTotal.toFixed(2)),
    });
  }

  return {
    items,
    ignoredLines,
    hasHeader: Boolean(mapping),
    columns: mapping ? Object.keys(mapping) : POSITIONAL.slice(0, headerCells.length),
  };
};


/**
 * Colagem com a sequência de colunas **declarada pelo usuário**.
 *
 * A versão que adivinha (`parsePastedItems`) continua existindo para a
 * sugestão, mas quem manda é esta: o usuário diz o que está colando, e o
 * sistema não inventa. Era a origem de importação trocada em silêncio —
 * quantidade entrando como valor porque a planilha daquela prefeitura tinha
 * uma coluna a mais no começo.
 */
export const converterItensComSequencia = (
  texto: string,
  sequencia: ColumnChoice<keyof PastedItem>[],
): PasteResult => {
  const { linhas, ignoradas, cabecalhoDescartado, colunasEncontradas } = aplicarSequencia(
    texto,
    sequencia,
    { obrigatorio: "produto", camposNumericos: NUMERICOS },
  );

  const items = linhas.map((linha) => {
    const quantidade = parseNumber(linha.quantidade ?? "");
    const valorUnitarioCelula = parseNumber(linha.valorUnitario ?? "");
    const valorTotalCelula = parseNumber(linha.valorTotal ?? "");

    // Um dos dois valores basta: a planilha que traz só o total tem o unitário
    // deduzido, e vice-versa. Trazendo os dois, o total informado vence — é o
    // que o fornecedor assinou.
    const valorTotal = valorTotalCelula || quantidade * valorUnitarioCelula;
    const unitario = valorUnitarioCelula || (quantidade > 0 ? valorTotal / quantidade : 0);

    return {
      produto: linha.produto ?? "",
      descricao: linha.descricao ?? "",
      unidadeMedida: (linha.unidadeMedida || "UN").toUpperCase(),
      marca: linha.marca ?? "",
      quantidade,
      valorUnitario: Number(unitario.toFixed(4)),
      valorTotal: Number(valorTotal.toFixed(2)),
    };
  });

  return {
    items,
    ignoredLines: ignoradas,
    hasHeader: cabecalhoDescartado,
    columns: Array.from({ length: colunasEncontradas }, (_, indice) => `Coluna ${indice + 1}`),
  };
};

/** Sinônimos usados só para sugerir a sequência a partir do cabeçalho. */
export const sugerirSequenciaDeItens = (texto: string) =>
  sugerirSequencia<keyof PastedItem>(texto, COLUMN_ALIASES);


/**
 * Campos oferecidos na colagem de PDF, com o tipo que ancora a extração.
 *
 * `texto` absorve o meio do bloco; `numero` e `palavra` consomem um token cada.
 * A numeração do item (1, 1.1) e o código entram como campos descartáveis: o
 * orçamento os traz, e o contrato não tem onde guardá-los — marcá-los é o que
 * permite ao extrator saber que existem e pular.
 */
export const CAMPOS_DO_PDF: FieldSpec<keyof PastedItem | "numeracao" | "codigo" | "fonte">[] = [
  { campo: "numeracao", rotulo: "Nº do item", tipo: "numero" },
  { campo: "codigo", rotulo: "Código", tipo: "palavra" },
  { campo: "produto", rotulo: "Especificação", tipo: "texto" },
  { campo: "fonte", rotulo: "Fonte (SINAPI/ORSE)", tipo: "palavra" },
  { campo: "unidadeMedida", rotulo: "Unidade", tipo: "palavra" },
  { campo: "marca", rotulo: "Marca", tipo: "palavra" },
  { campo: "quantidade", rotulo: "Quantidade", tipo: "numero" },
  { campo: "valorUnitario", rotulo: "Valor unitário", tipo: "numero" },
  { campo: "valorTotal", rotulo: "Valor total", tipo: "numero" },
];

/** Rótulos que aparecem no cabeçalho copiado junto e precisam ser cortados. */
const ROTULOS_DE_CABECALHO = [
  "ITEM", "CÓDIGO", "ESPECIFICAÇÃO", "DESCRIÇÃO", "FONTE", "UNIDADE", "UND",
  "QTD", "QUANTIDADE", "VALOR UNIT", "VALOR TOTAL", "PREÇO UNITÁRIO",
  "PREÇO TOTAL", "CUSTO DIRETO", "MÃO DE OBRA", "MATERIAL", "BDI",
];

export type PdfPasteResult = PasteResult & {
  /** Blocos sem números suficientes: cabeçalho, seção ou subtotal. */
  descartados: number;
};

/**
 * Colagem de PDF: texto corrido, com os campos declarados pelo usuário.
 *
 * O cabeçalho vem grudado no primeiro item quando o PDF não preserva quebras,
 * então ele é cortado antes de separar os blocos.
 */
export const converterItensDoPdf = (
  texto: string,
  sequencia: FieldSpec<string>[],
): PdfPasteResult => {
  const semCabecalho = removerCabecalho(texto, ROTULOS_DE_CABECALHO);
  const { linhas, descartados } = extrairDoPdf(semCabecalho, sequencia);

  const items = linhas.map((linha) => {
    const quantidade = parseNumber(linha.quantidade ?? "");
    const unitarioCelula = parseNumber(linha.valorUnitario ?? "");
    const totalCelula = parseNumber(linha.valorTotal ?? "");

    const valorTotal = totalCelula || quantidade * unitarioCelula;
    const unitario = unitarioCelula || (quantidade > 0 ? valorTotal / quantidade : 0);

    // Código e fonte não têm coluna no contrato, e jogá-los fora perderia o
    // rastro do orçamento. Vão para a descrição, que é campo livre.
    const rastro = [linha.numeracao, linha.fonte, linha.codigo]
      .filter(Boolean)
      .join(" · ");

    return {
      produto: (linha.produto ?? "").slice(0, 150),
      descricao: [rastro, linha.produto].filter(Boolean).join(" — "),
      unidadeMedida: (linha.unidadeMedida || "UN").toUpperCase(),
      marca: linha.marca ?? "",
      quantidade,
      valorUnitario: Number(unitario.toFixed(4)),
      valorTotal: Number(valorTotal.toFixed(2)),
    };
  });

  return {
    items,
    ignoredLines: descartados,
    hasHeader: semCabecalho.length < texto.length,
    columns: [],
    descartados,
  };
};
