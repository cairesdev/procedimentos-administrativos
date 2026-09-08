/**
 * A fila, medida como ela é.
 *
 * Duas esperas diferentes, e confundi-las é o erro que faz um relatório
 * parecer bom:
 *
 * - **Espera consumada**: de `indicada_em` até `iniciada_em`. Já acabou, e é
 *   dela que sai o "tempo médio para início do atendimento" do ofício.
 * - **Espera viva**: de `indicada_em` até hoje, de quem **ainda não começou**.
 *   Ela cresce sozinha enquanto ninguém atende.
 *
 * A média das consumadas, sozinha, mente por omissão: um município que atende
 * rápido os poucos que consegue e deixa duzentos parados tem média excelente e
 * fila péssima. Por isso os dois números saem sempre juntos, e o relatório não
 * oferece um sem o outro.
 */

import { diaLocal } from "./DataDoCalendario";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Dias entre dois dias do calendário **local**.
 *
 * Local porque a prefeitura é local: a sessão das 22h de terça aconteceu na
 * terça para todo mundo que estava lá, mesmo que em UTC já fosse quarta.
 */
export const diasEntre = (inicio: Date | string, fim: Date | string): number =>
  Math.round((diaLocal(fim) - diaLocal(inicio)) / MS_POR_DIA);

export type EsperaDeIndicacao = {
  indicadaEm: Date | string;
  /** Nulo = ainda na fila. */
  iniciadaEm: Date | string | null;
};

export type RetratoDaFila = {
  /** Quantos ainda não começaram. */
  naFila: number;
  /** Há quantos dias espera quem espera há mais tempo. */
  esperaMaisAntiga: number;
  /** Média dos que ainda esperam. */
  mediaNaFila: number;
  /** Quantos já começaram, no período apurado. */
  iniciados: number;
  /** Média de dias entre a indicação e a primeira sessão, de quem começou. */
  mediaAteIniciar: number;
  /** A mediana, que resiste a um caso extremo puxar a média. */
  medianaAteIniciar: number;
};

const media = (valores: number[]): number =>
  valores.length === 0
    ? 0
    : Math.round(valores.reduce((soma, valor) => soma + valor, 0) / valores.length);

/**
 * A mediana entra ao lado da média de propósito.
 *
 * Uma criança que esperou três anos puxa a média de vinte para cima e faz
 * parecer que todo mundo espera muito; cinquenta atendidas em uma semana
 * puxam para baixo e escondem as que esperam. Quando as duas divergem muito, é
 * sinal de que a fila não é homogênea — e isso é informação, não ruído.
 */
const mediana = (valores: number[]): number => {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1
    ? ordenados[meio]!
    : Math.round((ordenados[meio - 1]! + ordenados[meio]!) / 2);
};

export const retratoDaFila = (
  indicacoes: EsperaDeIndicacao[],
  hoje: Date = new Date(),
): RetratoDaFila => {
  const esperando: number[] = [];
  const consumadas: number[] = [];

  for (const indicacao of indicacoes) {
    if (indicacao.iniciadaEm) {
      consumadas.push(diasEntre(indicacao.indicadaEm, indicacao.iniciadaEm));
    } else {
      esperando.push(diasEntre(indicacao.indicadaEm, hoje));
    }
  }

  return {
    naFila: esperando.length,
    esperaMaisAntiga: esperando.length > 0 ? Math.max(...esperando) : 0,
    mediaNaFila: media(esperando),
    iniciados: consumadas.length,
    mediaAteIniciar: media(consumadas),
    medianaAteIniciar: mediana(consumadas),
  };
};

/**
 * A periodicidade que de fato aconteceu, em sessões por semana.
 *
 * Conta **só as sessões com comparecimento**, numa janela de dias, e divide
 * pelas semanas da janela. Falta é registrada e não conta aqui: o ofício
 * pergunta a periodicidade das terapias *ofertadas*, e sessão a que a pessoa
 * não veio não é terapia recebida.
 *
 * A janela é do chamador porque o período do ofício varia — o promotor pede
 * "nos últimos 90 dias" numa requisição e "no exercício de 2026" na seguinte.
 */
export const periodicidadeApurada = (
  sessoesComparecidas: number,
  diasDaJanela: number,
): number => {
  if (diasDaJanela <= 0) return 0;
  const semanas = diasDaJanela / 7;
  return Math.round((sessoesComparecidas / semanas) * 10) / 10;
};

/**
 * O que foi combinado contra o que aconteceu.
 *
 * `null` quando não há periodicidade combinada — e nesse caso o relatório diz
 * "não informada" em vez de inventar 100%. Sem isso, indicação sem combinado
 * apareceria como oferta cumprida, que é o oposto da verdade.
 */
export const aderencia = (
  combinadaSemanal: number | null,
  apuradaSemanal: number,
): number | null => {
  if (!combinadaSemanal || combinadaSemanal <= 0) return null;
  return Math.round((apuradaSemanal / combinadaSemanal) * 100);
};
