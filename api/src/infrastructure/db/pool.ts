import { Pool, types } from "pg";
import { env } from "../../config/env";
import type { ExecutorDeTransacao } from "../../application/ports/Transacao";

/**
 * `DATE` chega como texto, não como `Date`.
 *
 * O driver converte DATE para um `Date` do JS interpretado no fuso do
 * processo — e uma data pura não tem hora nem fuso: 2026-08-26 é o dia 26,
 * em qualquer lugar. A conversão só introduz um horário fictício que depois
 * precisa ser desfeito.
 *
 * Todos os ports já declaram estas colunas como `string`, e o TypeScript não
 * percebia a diferença porque `pool.query` devolve `any`. O primeiro a
 * tropeçar foi `diasAteVencer`, com "dataValidade.slice is not a function"
 * derrubando o plano de liberação — e, com ele, o botão de liberar.
 *
 * OID 1082 = DATE. `TIMESTAMPTZ` continua vindo como `Date`: ali o instante
 * e o fuso são a informação.
 */
types.setTypeParser(1082, (valor) => valor);

export const pool = new Pool({ connectionString: env.databaseUrl });

export const executarEmTransacao: ExecutorDeTransacao = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
