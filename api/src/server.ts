import { env } from "./config/env";
import { criarApp } from "./interface/http/app";

const app = criarApp();

app.listen(env.port, () => {
  console.log(`API de procedimentos administrativos ouvindo na porta ${env.port}`);
});
