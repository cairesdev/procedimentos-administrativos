import { parseNumber } from "@/shared/lib/spreadsheet-paste";

/**
 * Colagem da planilha de entrada do almoxarifado.
 *
 * O formato é o mesmo que o sistema legado já usava — NOME, UNIDADE,
 * QUANTIDADE, DATA_VALIDADE — porque é a planilha que as prefeituras já
 * preenchem. Não há valor: aqui se controla quantidade e validade, não preço.
 *
 * Existe separado do `spreadsheet-paste` dos contratos porque aquele espera
 * colunas de dinheiro e este espera validade. Forçar um só cobriria os dois
 * casos pela metade.
 */

export type PastedLine = {
  nome: string;
  unidade: string;
  quantidade: number;
  dataValidade: string | null;
};

export type StockPasteResult = {
  linhas: PastedLine[];
  ignoradas: number;
  temCabecalho: boolean;
  /** Linhas cuja data não foi entendida, para a tela avisar em vez de sumir. */
  datasInvalidas: number;
};

const SINONIMOS: Record<keyof PastedLine, string[]> = {
  nome: ["nome", "produto", "item", "material", "descricao", "especificacao"],
  unidade: ["unidade", "und", "un", "unid", "medida", "unidade de medida"],
  quantidade: ["quantidade", "qtd", "qtde", "quant", "qtd total"],
  dataValidade: ["data validade", "validade", "vencimento", "data de validade", "venc"],
};

const normalizar = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const separar = (linha: string): string[] =>
  linha.includes("\t") ? linha.split("\t") : linha.split(/[;|]/);

const detectarCabecalho = (celulas: string[]): Partial<Record<keyof PastedLine, number>> | null => {
  const mapa: Partial<Record<keyof PastedLine, number>> = {};

  celulas.forEach((celula, indice) => {
    const rotulo = normalizar(celula);
    if (!rotulo) return;

    for (const [campo, sinonimos] of Object.entries(SINONIMOS) as [keyof PastedLine, string[]][]) {
      if (mapa[campo] !== undefined) continue;
      if (sinonimos.some((alias) => rotulo === alias || rotulo.startsWith(`${alias} `))) {
        mapa[campo] = indice;
        return;
      }
    }
  });

  // Nome e quantidade bastam para tratar como cabeçalho: unidade e validade
  // são opcionais na planilha de muitas prefeituras.
  return mapa.nome !== undefined && mapa.quantidade !== undefined ? mapa : null;
};

/** Ordem assumida quando não há cabeçalho — a do legado. */
const POSICIONAL: (keyof PastedLine)[] = ["nome", "unidade", "quantidade", "dataValidade"];

/**
 * Aceita `2026-12-31` e `31/12/2026`. Devolve sempre ISO, que é o que a API
 * espera; data que não bate com nenhum dos dois vira `null` e é contada, para
 * a tela poder avisar em vez de gravar validade errada em silêncio.
 */
export const converterData = (texto: string): { data: string | null; invalida: boolean } => {
  const limpo = texto.trim();
  if (!limpo) return { data: null, invalida: false };

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpo);
  if (iso) return { data: `${iso[1]}-${iso[2]}-${iso[3]}`, invalida: false };

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(limpo);
  if (br) {
    const [, dia, mes, ano] = br;
    const anoCheio = ano!.length === 2 ? `20${ano}` : ano!;
    const data = `${anoCheio}-${mes!.padStart(2, "0")}-${dia!.padStart(2, "0")}`;
    // `Date.parse` recusa 31/02: melhor descartar que gravar data impossível.
    return Number.isNaN(Date.parse(`${data}T12:00:00Z`))
      ? { data: null, invalida: true }
      : { data, invalida: false };
  }

  return { data: null, invalida: true };
};

export const converterPlanilha = (texto: string): StockPasteResult => {
  const linhas = texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (linhas.length === 0) {
    return { linhas: [], ignoradas: 0, temCabecalho: false, datasInvalidas: 0 };
  }

  const mapa = detectarCabecalho(separar(linhas[0]!));
  const corpo = mapa ? linhas.slice(1) : linhas;

  const celula = (celulas: string[], campo: keyof PastedLine): string => {
    const indice = mapa ? mapa[campo] : POSICIONAL.indexOf(campo);
    if (indice === undefined || indice < 0) return "";
    return (celulas[indice] ?? "").trim();
  };

  let ignoradas = 0;
  let datasInvalidas = 0;
  const resultado: PastedLine[] = [];

  for (const linha of corpo) {
    const celulas = separar(linha);
    const nome = celula(celulas, "nome");
    const quantidade = parseNumber(celula(celulas, "quantidade"));

    // Linha sem produto ou sem quantidade não é entrada: é total, rodapé ou
    // separador que veio junto na cópia.
    if (!nome || quantidade <= 0) {
      ignoradas += 1;
      continue;
    }

    const { data, invalida } = converterData(celula(celulas, "dataValidade"));
    if (invalida) datasInvalidas += 1;

    resultado.push({
      nome: nome.toUpperCase(),
      unidade: (celula(celulas, "unidade") || "UN").toUpperCase(),
      quantidade,
      dataValidade: data,
    });
  }

  return { linhas: resultado, ignoradas, temCabecalho: Boolean(mapa), datasInvalidas };
};
