/**
 * Situação da validade de um lote — para a tela avisar, nunca para bloquear.
 *
 * A decisão é do levantamento e vale em todo o módulo: validade **só alerta**.
 * Bloquear a saída de lote vencido pareceria zelo, mas na prática o alimento
 * sairia por fora do sistema e o saldo ficaria errado para sempre. Melhor
 * registrar a saída e deixar o vencido visível para quem responde por ele.
 */

export type SituacaoDeValidade = "SEM_VALIDADE" | "VENCIDO" | "PROXIMO" | "OK";

export const ALERTA_VALIDADE_DIAS_PADRAO = 30;

/** Dias inteiros até vencer; negativo quando já venceu. */
export const diasAteVencer = (dataValidade: string | null, hoje: Date): number | null => {
  if (!dataValidade) return null;

  // Compara só a data, no fuso do município: o servidor roda em UTC e um lote
  // que vence hoje apareceria como vencido às 21h.
  const emSaoPaulo = (momento: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(momento);

  const inicioDoDia = (texto: string) => Date.parse(`${texto}T12:00:00Z`);
  const diferenca = inicioDoDia(dataValidade.slice(0, 10)) - inicioDoDia(emSaoPaulo(hoje));

  return Math.round(diferenca / (24 * 60 * 60 * 1000));
};

export const situacaoDaValidade = (
  dataValidade: string | null,
  hoje: Date,
  alertaDias: number = ALERTA_VALIDADE_DIAS_PADRAO,
): SituacaoDeValidade => {
  const dias = diasAteVencer(dataValidade, hoje);
  if (dias === null) return "SEM_VALIDADE";
  if (dias < 0) return "VENCIDO";
  return dias <= alertaDias ? "PROXIMO" : "OK";
};
