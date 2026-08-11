import { Pool } from "pg";
import { env } from "../../config/env";
import type { ExecutorDeTransacao } from "../../application/ports/Transacao";

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
