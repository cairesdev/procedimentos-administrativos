/**
 * Colagem de PDF: texto corrido, sem coluna nenhuma.
 *
 * Copiar de um PDF não traz tabulação nem, muitas vezes, quebra de linha — a
 * tabela inteira chega como um parágrafo só. O mapeamento por coluna
 * (`column-mapping.ts`) não serve aqui, porque não há colunas para mapear.
 *
 * O que existe é **tipo**. Número é reconhecível, unidade é uma palavra curta,
 * e o texto do serviço é tudo que sobra. Então o usuário declara quais campos
 * estão presentes e em que ordem, e a extração ancora nos campos reconhecíveis,
 * deixando o texto livre absorver o intervalo entre eles.
 *
 * Nem o cabeçalho ajuda: num orçamento real ele dizia `UND QTD` e o dado vinha
 * `12 Mês` — invertido. É por isso que a ordem é declarada, não adivinhada.
 *
 * Lógica pura, sem React: o teste roda a partir do projeto da API.
 */

export type FieldKind = "numero" | "palavra" | "texto";

/** `texto` absorve o meio; os demais consomem um token cada. */
export type FieldSpec<Campo extends string> = {
  campo: Campo;
  rotulo: string;
  tipo: FieldKind;
};

export type PdfExtraction<Campo extends string> = {
  linhas: Record<Campo, string>[];
  /** Blocos que não tinham números suficientes para a sequência pedida. */
  descartados: number;
};

/** Número brasileiro, com ou sem milhar: 6.000,00 · 12 · 0,30 · 220,00 */
const NUMERO = /^\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^\d+(?:[.,]\d+)?$/;

const ehNumero = (token: string): boolean => NUMERO.test(token);

/**
 * Limpa o ruído que o PDF traz junto.
 *
 * `R$` vem colado no valor ou solto como token; parênteses de unidade e
 * espaços duplos atrapalham a contagem de tokens. O que sobra é o dado.
 */
const limpar = (texto: string): string =>
  texto
    .replace(/R\$/g, " ")
    // Espaço fino, não separável e afins: o PDF usa vários, e todos parecem
    // espaço na tela mas não casam com `\s` em algumas engines antigas.
    .replace(/[  -​  　]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Corta o texto corrido em um bloco por item.
 *
 * A âncora é a numeração do item — `1`, `1.1`, `2.1.3` — quando ela vem logo
 * depois de um número, que é como todo item termina. Cortar em toda numeração
 * partiria a descrição ao meio: "TELHADOS DE ATÉ 2 ÁGUAS" tem um número
 * seguido de texto e não começa item nenhum.
 *
 * Texto que já vem em linhas separadas usa as linhas, que são mais confiáveis.
 */
export const separarItens = (texto: string): string[] => {
  const linhas = texto
    .split(/\r?\n/)
    .map((linha) => limpar(linha))
    .filter(Boolean);

  if (linhas.length > 1) return linhas;

  const corrido = limpar(texto);
  if (!corrido) return [];

  const numero = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;
  const numeracao = String.raw`\d+(?:\.\d+)*`;

  return corrido
    .split(new RegExp(String.raw`(?<=${numero})\s+(?=${numeracao}\s)`, "u"))
    .map((bloco) => bloco.trim())
    .filter(Boolean);
};

/**
 * Extrai um bloco segundo a sequência declarada.
 *
 * A leitura vai **das pontas para o meio**: os campos antes do texto livre
 * saem do começo, os de depois saem do fim, e o texto fica com o que sobrou.
 * Ler da esquerda para a direita não funcionaria — seria preciso saber onde a
 * descrição termina, que é justamente o que não se sabe.
 */
export const extrairBloco = <Campo extends string>(
  bloco: string,
  sequencia: FieldSpec<Campo>[],
): Record<Campo, string> | null => {
  const tokens = limpar(bloco).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  const indiceTexto = sequencia.findIndex((campo) => campo.tipo === "texto");
  const resultado = {} as Record<Campo, string>;

  // Sem campo de texto livre, cada posição consome um token, da esquerda.
  if (indiceTexto < 0) {
    if (tokens.length < sequencia.length) return null;
    sequencia.forEach((campo, indice) => {
      resultado[campo.campo] = tokens[indice] ?? "";
    });
    return resultado;
  }

  let fim = tokens.length - 1;

  for (let posicao = sequencia.length - 1; posicao > indiceTexto; posicao -= 1) {
    const campo = sequencia[posicao]!;

    if (campo.tipo === "numero") {
      // Anda para trás até achar um número: entre o valor e a unidade pode
      // haver ruído que a limpeza não pegou.
      while (fim >= 0 && !ehNumero(tokens[fim]!)) fim -= 1;
      if (fim < 0) return null;
    }
    if (fim < 0) return null;

    resultado[campo.campo] = tokens[fim] ?? "";
    fim -= 1;
  }

  let inicio = 0;
  for (let posicao = 0; posicao < indiceTexto; posicao += 1) {
    const campo = sequencia[posicao]!;

    if (campo.tipo === "numero") {
      while (inicio <= fim && !ehNumero(tokens[inicio]!)) inicio += 1;
      if (inicio > fim) return null;
    }
    resultado[campo.campo] = tokens[inicio] ?? "";
    inicio += 1;
  }

  const meio = tokens.slice(inicio, fim + 1).join(" ").trim();
  // Bloco sem nada no meio é linha de seção ou sobra de cabeçalho, não item.
  if (!meio) return null;

  resultado[sequencia[indiceTexto]!.campo] = meio;
  return resultado;
};

export const extrairDoPdf = <Campo extends string>(
  texto: string,
  sequencia: FieldSpec<Campo>[],
): PdfExtraction<Campo> => {
  if (sequencia.length === 0) return { linhas: [], descartados: 0 };

  const linhas: Record<Campo, string>[] = [];
  let descartados = 0;

  for (const bloco of separarItens(texto)) {
    const extraido = extrairBloco(bloco, sequencia);
    if (extraido) linhas.push(extraido);
    else descartados += 1;
  }

  return { linhas, descartados };
};

/**
 * O cabeçalho da tabela vem junto na cópia, e não é item.
 *
 * Reconhece-o pelo que ele **não** tem: nenhum número. A linha de título de um
 * orçamento é só rótulo — "ITEM ESPECIFICAÇÃO UND QTD VALOR UNIT VALOR TOTAL".
 * O corte é feito no texto inteiro, antes de separar os itens, porque no texto
 * corrido o cabeçalho está grudado no primeiro item.
 */
export const removerCabecalho = (texto: string, rotulos: string[]): string => {
  const corrido = limpar(texto);
  const normalizado = corrido
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

  // O fim do cabeçalho é a última ocorrência de um rótulo conhecido antes do
  // primeiro número solto — daí em diante já é dado.
  let fimDoCabecalho = -1;
  for (const rotulo of rotulos) {
    const alvo = rotulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase();
    const posicao = normalizado.indexOf(alvo);
    if (posicao >= 0) fimDoCabecalho = Math.max(fimDoCabecalho, posicao + alvo.length);
  }

  if (fimDoCabecalho < 0) return corrido;

  // Depois do último rótulo pode sobrar "(R$)" ou "- (R$)": anda até o próximo
  // token que comece um item.
  const resto = corrido.slice(fimDoCabecalho);
  const inicioDoDado = /\s\d/.exec(resto);
  return inicioDoDado ? resto.slice(inicioDoDado.index).trim() : resto.trim();
};
