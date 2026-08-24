import { randomInt } from "node:crypto";

/**
 * Código impresso na peça e usado na página pública de conferência.
 *
 * Sorteado, nunca sequencial: o código é a única chave de uma página sem
 * login, então um código adivinhável deixaria varrer os documentos de todas
 * as prefeituras. Também não carrega prefeitura nem data — isso vazaria
 * volume de emissão de cada cliente.
 *
 * Alfabeto sem 0/O e 1/I/L: o código é ditado por telefone e digitado à mão.
 */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GRUPOS = 3;
const POR_GRUPO = 4;

export const gerarCodigoVerificador = (): string =>
  Array.from({ length: GRUPOS }, () =>
    Array.from({ length: POR_GRUPO }, () => ALFABETO[randomInt(ALFABETO.length)]).join(""),
  ).join("-");

/** Aceita o código digitado com espaço, minúscula ou sem hífen. */
export const normalizarCodigo = (bruto: string): string => {
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpo.length !== GRUPOS * POR_GRUPO) return "";
  return limpo.match(new RegExp(`.{${POR_GRUPO}}`, "g"))!.join("-");
};
