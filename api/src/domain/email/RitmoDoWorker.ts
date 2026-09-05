/**
 * De quanto em quanto tempo o worker olha a fila, e quantos leva por vez.
 *
 * Números pequenos e sem consequência aparente — e é por isso que ficam aqui,
 * com trava. `Number(process.env.X)` devolve `NaN` para qualquer coisa que não
 * seja número, e `setTimeout(fn, NaN)` **dispara imediatamente**: uma linha
 * `EMAIL_INTERVALO_MS=15s` no `.env` (com o "s", que é o erro natural de quem
 * escreve "15 segundos") transformaria o worker num laço quente martelando o
 * Postgres, sem erro nenhum no log. É o tipo de defeito que só aparece na conta
 * de CPU da VPS.
 */

/** Quinze segundos: o aviso ao cidadão sai quase na hora, e a consulta é barata. */
export const INTERVALO_PADRAO_MS = 15_000;

/**
 * O piso.
 *
 * Abaixo disto o ganho é imperceptível para quem recebe o e-mail e o custo
 * deixa de ser: são quatro consultas por minuto contra doze, num índice parcial
 * que quase sempre volta vazio. Quem quiser envio instantâneo precisa de
 * `LISTEN/NOTIFY`, não de um intervalo menor.
 */
const INTERVALO_MINIMO_MS = 5_000;

/** Uma hora. Acima disso não é "intervalo", é "esqueceram do worker". */
const INTERVALO_MAXIMO_MS = 3_600_000;

export const LOTE_PADRAO = 20;
const LOTE_MAXIMO = 200;

/**
 * Lê o número do ambiente, ou cai no padrão.
 *
 * Vazio, ausente, com unidade colada, com vírgula decimal — tudo o que não for
 * um inteiro utilizável vira o padrão, e o chamador avisa no log. Silenciar é
 * que não dá: o worker rodaria com um ritmo que ninguém pediu.
 */
export const numeroDoAmbiente = (
  bruto: string | undefined,
  padrao: number,
  minimo: number,
  maximo: number,
): { valor: number; aviso?: string } => {
  if (bruto === undefined || bruto.trim() === "") return { valor: padrao };

  const numero = Number(bruto);
  if (!Number.isFinite(numero)) {
    return {
      valor: padrao,
      aviso: `"${bruto}" não é um número; usando ${padrao}. Informe só os dígitos.`,
    };
  }

  const inteiro = Math.round(numero);
  if (inteiro < minimo) {
    return { valor: minimo, aviso: `${inteiro} é baixo demais; usando o mínimo de ${minimo}.` };
  }
  if (inteiro > maximo) {
    return { valor: maximo, aviso: `${inteiro} é alto demais; usando o máximo de ${maximo}.` };
  }
  return { valor: inteiro };
};

export const intervaloDoAmbiente = (bruto = process.env.EMAIL_INTERVALO_MS) =>
  numeroDoAmbiente(bruto, INTERVALO_PADRAO_MS, INTERVALO_MINIMO_MS, INTERVALO_MAXIMO_MS);

export const loteDoAmbiente = (bruto = process.env.EMAIL_LOTE) =>
  numeroDoAmbiente(bruto, LOTE_PADRAO, 1, LOTE_MAXIMO);
