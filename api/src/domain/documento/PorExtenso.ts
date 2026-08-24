/**
 * Valor e data por extenso, como as ordens de serviço do legado exigem
 * ("dezoito mil e quatrocentos e um reais e quatorze centavos").
 */

const ATE_DEZENOVE = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
  "dezoito", "dezenove",
];

const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta",
  "sessenta", "setenta", "oitenta", "noventa",
];

const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** Grupos de três dígitos, do menor para o maior. */
const ESCALAS: { singular: string; plural: string }[] = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
];

/** 1..999 por extenso. */
const grupoPorExtenso = (numero: number): string => {
  if (numero === 100) return "cem";

  const centena = Math.floor(numero / 100);
  const resto = numero % 100;
  const partes: string[] = [];

  if (centena > 0) partes.push(CENTENAS[centena]!);

  if (resto > 0 && resto < 20) {
    partes.push(ATE_DEZENOVE[resto]!);
  } else if (resto >= 20) {
    const dezena = Math.floor(resto / 10);
    const unidade = resto % 10;
    partes.push(unidade > 0 ? `${DEZENAS[dezena]} e ${ATE_DEZENOVE[unidade]}` : DEZENAS[dezena]!);
  }

  return partes.join(" e ");
};

/** Inteiro por extenso, sem unidade monetária. */
export const numeroPorExtenso = (inteiro: number): string => {
  if (inteiro === 0) return ATE_DEZENOVE[0]!;
  if (inteiro < 0) return `menos ${numeroPorExtenso(Math.abs(inteiro))}`;

  const grupos: number[] = [];
  let restante = inteiro;
  while (restante > 0) {
    grupos.push(restante % 1000);
    restante = Math.floor(restante / 1000);
  }
  if (grupos.length > ESCALAS.length) {
    throw new Error("Valor grande demais para escrever por extenso");
  }

  const escritos: string[] = [];
  for (let escala = grupos.length - 1; escala >= 0; escala -= 1) {
    const grupo = grupos[escala]!;
    if (grupo === 0) continue;

    // "mil" não leva "um" na frente: 1000 é "mil", não "um mil".
    const prefixo = escala === 1 && grupo === 1 ? "" : grupoPorExtenso(grupo);
    const sufixo = escala === 0 ? "" : grupo === 1 ? ESCALAS[escala]!.singular : ESCALAS[escala]!.plural;
    escritos.push([prefixo, sufixo].filter(Boolean).join(" "));
  }

  // A norma liga o último grupo com "e" quando ele é menor que cem ou múltiplo
  // de cem — "mil e quinze", mas "mil cento e quinze".
  const ultimo = grupos[0]!;
  const ligaComE = escritos.length > 1 && ultimo > 0 && (ultimo < 100 || ultimo % 100 === 0);
  if (ligaComE) {
    const fim = escritos.pop()!;
    return `${escritos.join(", ")} e ${fim}`;
  }
  return escritos.join(", ");
};

/** Valor monetário por extenso, com reais e centavos. */
export const valorPorExtenso = (valor: number): string => {
  // Arredonda em centavos antes de separar: 0.1 + 0.2 em ponto flutuante
  // daria 30 centavos escritos como 29.
  const centavosTotais = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partes: string[] = [];
  if (reais > 0) {
    // "um milhão DE reais", mas "um milhão e quinhentos mil reais": o "de"
    // só entra quando a escrita termina na palavra da escala.
    const terminaEmEscala = reais >= 1_000_000 && reais % 1_000_000 === 0;
    const unidade = `${terminaEmEscala ? "de " : ""}${reais === 1 ? "real" : "reais"}`;
    partes.push(`${numeroPorExtenso(reais)} ${unidade}`);
  }
  if (centavos > 0) {
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  if (partes.length === 0) return "zero reais";

  const escrito = partes.join(" e ");
  return valor < 0 ? `menos ${escrito}` : escrito;
};

const DIAS_DA_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * "segunda-feira, 24 de agosto de 2026" — o formato que o legado imprime.
 *
 * O fuso é fixo em America/Sao_Paulo: a data do documento é a do município,
 * não a do relógio do servidor, que em container roda em UTC e viraria o dia
 * às 21h.
 */
export const dataPorExtenso = (
  momento: Date,
  opcoes: { comDiaDaSemana?: boolean } = {},
): string => {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(momento);

  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  const dia = Number(pegar("day"));
  const mes = MESES[Number(pegar("month")) - 1];
  const ano = pegar("year");
  const escrita = `${dia} de ${mes} de ${ano}`;

  if (opcoes.comDiaDaSemana === false) return escrita;

  // O nome do dia vem do Intl para não depender do fuso do processo.
  const diaDaSemana = DIAS_DA_SEMANA[
    new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric", month: "2-digit", day: "2-digit",
      }).format(momento) + "T12:00:00Z",
    ).getUTCDay()
  ];

  return `${diaDaSemana}, ${escrita}`;
};
