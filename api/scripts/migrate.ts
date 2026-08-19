import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "pg";

// Aplicador de migrations para container: lê db/migrations em ordem e roda
// o que ainda não está em schema_migrations. Cada arquivo roda numa transação,
// então metade de uma migration nunca fica aplicada.

// Roda tanto de scripts/ (tsx) quanto de dist/scripts/ (compilado).
const localizarMigrations = (): string => {
  const candidatos = [
    process.env.MIGRATIONS_DIR,
    join(__dirname, "..", "db", "migrations"),
    join(__dirname, "..", "..", "db", "migrations"),
    resolve(process.cwd(), "db", "migrations"),
  ].filter((caminho): caminho is string => Boolean(caminho));

  const encontrado = candidatos.find((caminho) => existsSync(caminho));
  if (!encontrado) {
    throw new Error(`Pasta de migrations não encontrada. Tentei: ${candidatos.join(", ")}`);
  }
  return encontrado;
};


const CRIAR_CONTROLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    arquivo     TEXT PRIMARY KEY,
    aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

// Trava de sessão: duas réplicas subindo juntas não aplicam a mesma migration.
const TRAVA = 8_142_026;

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Variável de ambiente obrigatória ausente: DATABASE_URL");

  const pasta = localizarMigrations();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [TRAVA]);
    await client.query(CRIAR_CONTROLE);

    const { rows } = await client.query<{ arquivo: string }>(
      "SELECT arquivo FROM schema_migrations",
    );
    const aplicadas = new Set(rows.map((linha) => linha.arquivo));

    const pendentes = readdirSync(pasta)
      .filter((arquivo) => arquivo.endsWith(".sql"))
      .sort()
      .filter((arquivo) => !aplicadas.has(arquivo));

    if (pendentes.length === 0) {
      console.log("Migrations: nada pendente.");
      return;
    }

    for (const arquivo of pendentes) {
      const sql = readFileSync(join(pasta, arquivo), "utf8");
      console.log(`Migrations: aplicando ${arquivo}`);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (arquivo) VALUES ($1)", [arquivo]);
        await client.query("COMMIT");
      } catch (erro) {
        await client.query("ROLLBACK");
        throw new Error(`Falha em ${arquivo}: ${(erro as Error).message}`);
      }
    }

    console.log(`Migrations: ${pendentes.length} aplicada(s).`);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [TRAVA]).catch(() => undefined);
    await client.end();
  }
};

main().catch((erro: Error) => {
  console.error(erro.message);
  process.exit(1);
});
