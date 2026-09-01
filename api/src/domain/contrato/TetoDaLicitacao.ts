/**
 * O quanto de uma licitação ainda pode virar contrato.
 *
 * A licitação autoriza um valor. Os contratos que nascem dela, somados, não
 * podem passar disso — e até aqui nada impedia: o valor da licitação era um
 * campo que ninguém lia depois de gravado.
 *
 * Regra pura, e por isso testável sem banco: a consulta traz os dois números,
 * a decisão mora aqui.
 */

export type Teto = {
  /** O que a licitação autorizou. */
  valorLicitacao: number;
  /** A soma dos contratos que já nasceram dela — sem contar o que está entrando. */
  jaContratado: number;
};

/**
 * Centavos, e não reais.
 *
 * `0.1 + 0.2 > 0.3` em ponto flutuante, e um contrato que fecha exatamente no
 * teto seria recusado por um erro de arredondamento invisível. Os valores vêm
 * do Postgres como `NUMERIC(14,2)`, então dois decimais bastam.
 */
const emCentavos = (valor: number): number => Math.round(valor * 100);

export const disponivelNaLicitacao = (teto: Teto): number =>
  (emCentavos(teto.valorLicitacao) - emCentavos(teto.jaContratado)) / 100;

/** Cabe? Exatamente no teto cabe — é o valor autorizado, não um a menos. */
export const cabeNaLicitacao = (teto: Teto, valorDoContrato: number): boolean =>
  emCentavos(teto.jaContratado) + emCentavos(valorDoContrato)
    <= emCentavos(teto.valorLicitacao);
