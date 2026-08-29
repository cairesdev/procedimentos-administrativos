/**
 * Colagem de planilha com as colunas **declaradas pelo usuário**.
 *
 * Antes o sistema adivinhava: procurava um cabeçalho conhecido e, quando não
 * achava, assumia uma ordem fixa. As planilhas das prefeituras variam demais
 * para isso dar certo — cada uma tem suas colunas, na sua ordem, com uma de
 * item nº na frente ou uma de observação no meio. Quando o palpite errava, os
 * dados entravam trocados **em silêncio**: quantidade no lugar de valor, marca
 * no lugar de descrição. O usuário só descobria depois, no documento impresso.
 *
 * Agora ele diz o que está colando e em que ordem. A detecção continua
 * existindo, mas rebaixada a sugestão: propõe a sequência e espera confirmação.
 *
 * Este módulo é lógica pura, sem React, e o teste dele roda a partir do projeto
 * da API — por isso não usa o alias `@/`.
 */

/** `null` = coluna que existe na planilha e não interessa. */
export type ColumnChoice<Campo extends string> = Campo | null;

export type MappedRow = Record<string, string>;

export type MappingResult = {
  /** Uma entrada por linha de dado, já com os campos nomeados. */
  linhas: MappedRow[];
  /** Linhas puladas por não terem o campo obrigatório. */
  ignoradas: number;
  /** A primeira linha parecia cabeçalho e foi descartada. */
  cabecalhoDescartado: boolean;
  /** Quantas colunas a planilha trouxe, para a tela avisar de sobra ou falta. */
  colunasEncontradas: number;
};

const normalizar = (valor: string): string =>
  valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Tabulação primeiro: é o que o Excel e o Google Sheets põem na área de
 * transferência. Ponto e vírgula e barra vertical cobrem o CSV exportado.
 *
 * Vírgula ficou de fora de propósito — em planilha brasileira ela é separador
 * decimal, e dividir por ela partiria "1.234,56" ao meio.
 */
export const separarCelulas = (linha: string): string[] =>
  linha.includes("\t") ? linha.split("\t") : linha.split(/[;|]/);

/**
 * Linhas com conteúdo, aparadas **sem tocar nas tabulações**.
 *
 * `trim()` remove tabs junto com os espaços, e é o bastante para estragar a
 * importação: numa planilha cuja primeira coluna esteja vazia — item nº em
 * branco, coluna de conferência —, `"\tARROZ\t10"` viraria `"ARROZ\t10"` e
 * todas as colunas seguintes andariam uma casa. Com a sequência declarada pelo
 * usuário isso seria pior ainda: ele mapeou pensando na posição real.
 *
 * Por isso apara-se só espaço e `\r`. A tabulação é dado: ela diz que existe
 * uma célula ali, mesmo vazia.
 */
const linhasUteis = (texto: string): string[] =>
  texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^[ \r]+|[ \r]+$/g, ""))
    .filter((linha) => linha.replace(/[\t;|]/g, "").trim() !== "");

/** As primeiras linhas, já separadas — alimenta a prévia e a sugestão. */
export const espiarColunas = (texto: string, quantas = 4): string[][] =>
  linhasUteis(texto).slice(0, quantas).map(separarCelulas);

/**
 * Sugere a sequência a partir do cabeçalho, quando reconhece um.
 *
 * Devolve `null` quando não reconhece nada — e nesse caso a tela não propõe
 * nada, em vez de propor um palpite que o usuário aceitaria sem conferir.
 * Coluna sem correspondente vira `null` na sequência: a planilha tem, e ela
 * não entra.
 */
export const sugerirSequencia = <Campo extends string>(
  texto: string,
  sinonimos: Record<Campo, string[]>,
): ColumnChoice<Campo>[] | null => {
  const [primeira] = espiarColunas(texto, 1);
  if (!primeira) return null;

  const usados = new Set<Campo>();
  let reconhecidas = 0;

  const sequencia = primeira.map((celula) => {
    const rotulo = normalizar(celula);
    if (!rotulo) return null;

    for (const [campo, alternativas] of Object.entries(sinonimos) as [Campo, string[]][]) {
      if (usados.has(campo)) continue;
      if (alternativas.some((alias) => rotulo === alias || rotulo.startsWith(`${alias} `))) {
        usados.add(campo);
        reconhecidas += 1;
        return campo;
      }
    }
    return null;
  });

  // Uma coluna reconhecida não é cabeçalho: é coincidência. Uma linha de dado
  // cujo primeiro campo seja "MATERIAL DE LIMPEZA" casaria com "material".
  return reconhecidas >= 2 ? sequencia : null;
};

/**
 * A primeira linha é cabeçalho?
 *
 * A pergunta importa mesmo com a sequência declarada: o usuário diz a ORDEM
 * das colunas, e continua havendo a linha de título para descartar.
 *
 * O critério tem duas metades, e a segunda custou um teste para aparecer:
 *
 * 1. Nenhum campo numérico tem dígito — cabeçalho não escreve "1500" na coluna
 *    de quantidade.
 * 2. Pelo menos um deles tem **texto**. Sem esta parte, uma linha de seção
 *    ("HORTIFRUTI" seguido de células vazias) passava por cabeçalho e era
 *    descartada em silêncio; pior, uma planilha que começasse por um item de
 *    quantidade em branco perderia a primeira linha de dado.
 */
export const pareceCabecalho = <Campo extends string>(
  celulas: string[],
  sequencia: ColumnChoice<Campo>[],
  camposNumericos: Campo[],
): boolean => {
  const numericos = sequencia
    .map((campo, indice) => ({ campo, indice }))
    .filter(({ campo }) => campo !== null && camposNumericos.includes(campo));

  if (numericos.length === 0) return false;

  const conteudos = numericos.map(({ indice }) => (celulas[indice] ?? "").trim());

  const nenhumTemDigito = conteudos.every((valor) => !/\d/.test(valor));
  const algumTemTexto = conteudos.some((valor) => valor !== "");

  return nenhumTemDigito && algumTemTexto;
};

/**
 * Aplica a sequência declarada ao texto colado.
 *
 * `obrigatorio` é o campo sem o qual a linha não é dado — normalmente o nome do
 * produto. É o que separa a linha de item da linha de total, do rodapé e do
 * separador que veio junto na cópia.
 */
export const aplicarSequencia = <Campo extends string>(
  texto: string,
  sequencia: ColumnChoice<Campo>[],
  opcoes: { obrigatorio: Campo; camposNumericos?: Campo[] },
): MappingResult => {
  const linhas = linhasUteis(texto);
  if (linhas.length === 0) {
    return { linhas: [], ignoradas: 0, cabecalhoDescartado: false, colunasEncontradas: 0 };
  }

  const primeira = separarCelulas(linhas[0]!);
  const cabecalhoDescartado = pareceCabecalho(
    primeira, sequencia, opcoes.camposNumericos ?? [],
  );
  const corpo = cabecalhoDescartado ? linhas.slice(1) : linhas;

  const posicao = new Map<Campo, number>();
  sequencia.forEach((campo, indice) => {
    // Primeira ocorrência vence: se o usuário marcar o mesmo campo duas vezes,
    // a segunda é ignorada em vez de sobrescrever silenciosamente.
    if (campo !== null && !posicao.has(campo)) posicao.set(campo, indice);
  });

  let ignoradas = 0;
  const resultado: MappedRow[] = [];

  for (const linha of corpo) {
    const celulas = separarCelulas(linha);
    const valor = (campo: Campo) => (celulas[posicao.get(campo) ?? -1] ?? "").trim();

    if (!valor(opcoes.obrigatorio)) {
      ignoradas += 1;
      continue;
    }

    const mapeada: MappedRow = {};
    for (const [campo, indice] of posicao) {
      mapeada[campo] = (celulas[indice] ?? "").trim();
    }
    resultado.push(mapeada);
  }

  return {
    linhas: resultado,
    ignoradas,
    cabecalhoDescartado,
    colunasEncontradas: primeira.length,
  };
};
