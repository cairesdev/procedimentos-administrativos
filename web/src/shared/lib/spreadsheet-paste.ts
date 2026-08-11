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
