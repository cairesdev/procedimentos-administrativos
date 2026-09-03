/**
 * Data como se lê num documento.
 *
 * A distinção que importa: **um dia do calendário não é um instante.**
 *
 * `2026-01-01` é o primeiro de janeiro, e continua sendo em qualquer fuso.
 * Passá-lo por `new Date()` o transforma em meia-noite UTC, que em São Paulo é
 * 21h do dia 31 de dezembro — e a peça sai com o dia anterior. Foi o que
 * aconteceu com o período dos relatórios ("31/12/2025 a 29/06/2026" onde devia
 * estar 01/01 a 30/06) e com a validade dos lotes nas peças do almoxarifado,
 * que imprimiam sempre um dia a menos.
 *
 * O driver devolve as colunas `DATE` como texto justamente para preservar essa
 * distinção; o erro estava em jogá-lo fora aqui. Então: se o valor **é** um dia
 * do calendário, formata-se como texto, sem fuso nenhum no caminho. Só o que é
 * instante de verdade — `TIMESTAMPTZ`, que chega como `Date` — passa pela
 * conversão para o horário de Brasília.
 */
const DIA_DO_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/;

export const dataDoDocumento = (valor: unknown): string => {
  if (!(valor instanceof Date)) {
    const dia = String(valor ?? "").match(DIA_DO_CALENDARIO);
    if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  }

  const instante = valor instanceof Date ? valor : new Date(String(valor));

  /**
   * Texto que não é data vira traço, e não exceção.
   *
   * `Intl` lança `RangeError` diante de uma data inválida, e aqui isso
   * derrubaria a emissão inteira por causa de um campo. O traço é o mesmo que o
   * resto do sistema usa para ausência: a peça sai, com uma lacuna visível que
   * quem assina percebe.
   */
  if (Number.isNaN(instante.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instante);
};
