import { env, validarParaApi } from "./config/env";
import { criarApp } from "./interface/http/app";

/**
 * Tudo o que a API precisa é conferido aqui, antes de qualquer coisa.
 *
 * As variáveis passaram a ser lidas sob demanda (ver `config/env.ts`) para o
 * worker de e-mail não precisar de `JWT_SECRET`. Sem esta linha, a API subiria
 * sem segredo e só quebraria no primeiro login — de manhã, com gente
 * esperando. Falta de configuração tem de derrubar o contêiner no `up`.
 */
validarParaApi();

const app = criarApp();

app.listen(env.port, () => {
  console.log(`API de procedimentos administrativos ouvindo na porta ${env.port}`);
});
