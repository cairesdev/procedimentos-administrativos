import { hash } from "bcryptjs";
import { Client } from "pg";

// Cria (ou atualiza a senha do) administrador master a partir do ambiente.
// Sem ele o container sobe com o banco vazio e ninguém consegue entrar em /admin.
const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_SENHA;
  const nome = process.env.ADMIN_NOME ?? "Administrador do sistema";

  if (!databaseUrl) throw new Error("Variável de ambiente obrigatória ausente: DATABASE_URL");
  if (!email || !senha) {
    console.log("Admin master: ADMIN_EMAIL/ADMIN_SENHA não definidos, nada a fazer.");
    return;
  }
  if (senha.length < 8) throw new Error("ADMIN_SENHA precisa de ao menos 8 caracteres");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const senhaHash = await hash(senha, 10);
    await client.query(
      `INSERT INTO admin_sistema (nome, email, senha_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email)
       DO UPDATE SET nome = $1, senha_hash = $3, ativo = TRUE`,
      [nome, email.toLowerCase(), senhaHash],
    );
    console.log(`Admin master: ${email} pronto.`);
  } finally {
    await client.end();
  }
};

main().catch((erro: Error) => {
  console.error(erro.message);
  process.exit(1);
});
