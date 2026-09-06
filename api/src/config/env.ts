import "dotenv/config";

/**
 * As variáveis de ambiente, cobradas **na hora do uso**.
 *
 * Antes eram cobradas no import, e isso derrubou o worker de e-mail em
 * produção: `pool.ts` importa este arquivo, o worker importa `pool.ts`, e o
 * import exigia `JWT_SECRET` — de um processo que nunca emite nem confere
 * token. O contêiner ficou reiniciando em laço por 22 horas, a fila nunca
 * andou, e a tela dizia "e-mails esperando o próximo envio", que parece normal.
 *
 * Cada processo agora precisa do que **ele** usa: o worker, do banco; a API,
 * do banco e do segredo. Exigir no import acopla os dois, e o acoplamento só
 * aparece quando alguém sobe um processo novo.
 *
 * **Isso não é ficar frouxo.** A API continua conferindo tudo no arranque, e
 * de propósito: descobrir que falta `JWT_SECRET` no primeiro login de segunda
 * de manhã seria pior que não subir. Quem faz isso é `validarParaApi()`, na
 * primeira linha do `server.ts`.
 */

const obrigatoria = (nome: string): string => {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
};

export const env = {
  /** O banco. Todo processo precisa dele. */
  get databaseUrl(): string {
    return obrigatoria("DATABASE_URL");
  },
  /** O segredo do token. Só quem atende HTTP autenticado precisa. */
  get jwtSecret(): string {
    return obrigatoria("JWT_SECRET");
  },
  get port(): number {
    return Number(process.env.PORT ?? 3333);
  },
};

/**
 * O que a API exige para subir.
 *
 * Chamada no arranque do servidor, antes de qualquer coisa: falta de segredo
 * tem de derrubar o contêiner no `docker compose up`, com o nome da variável
 * na primeira linha do log — não no primeiro login de quem chegou para
 * trabalhar.
 */
export const validarParaApi = (): void => {
  obrigatoria("DATABASE_URL");
  obrigatoria("JWT_SECRET");
};
