import "dotenv/config";

const obrigatoria = (nome: string): string => {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
};

export const env = {
  databaseUrl: obrigatoria("DATABASE_URL"),
  jwtSecret: obrigatoria("JWT_SECRET"),
  port: Number(process.env.PORT ?? 3333),
};
