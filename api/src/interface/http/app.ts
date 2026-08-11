import express from "express";
import { authRouter } from "./routes/auth";
import { licitacoesRouter } from "./routes/licitacoes";
import { contratosRouter } from "./routes/contratos";
import { solicitacoesRouter } from "./routes/solicitacoes";
import { processosRouter } from "./routes/processos";
import { auditoriaRouter } from "./routes/auditoria";
import { setoresRouter, unidadesRouter } from "./routes/organizacao";
import { fornecedoresRouter } from "./routes/fornecedores";
import { fluxosRouter } from "./routes/fluxos";
import { usuariosRouter } from "./routes/usuarios";
import { authenticate } from "./middlewares/authenticate";
import { resolveTenant } from "./middlewares/resolveTenant";
import { errorHandler } from "./middlewares/errorHandler";

export const criarApp = () => {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);

  // Cadastros organizacionais: órgão ativo, sem exigência de módulo.
  app.use("/unidades", authenticate, resolveTenant(), unidadesRouter);
  app.use("/setores", authenticate, resolveTenant(), setoresRouter);
  app.use("/usuarios", authenticate, resolveTenant(), usuariosRouter);
  app.use("/fluxos", authenticate, resolveTenant(), fluxosRouter);
  app.use("/auditoria", authenticate, resolveTenant(), auditoriaRouter);

  // Fornecedor é cadastro global — autenticação basta.
  app.use("/fornecedores", authenticate, fornecedoresRouter);

  // Módulo de processos: exige habilitação do módulo para o órgão.
  app.use("/licitacoes", authenticate, resolveTenant("PROCESSOS"), licitacoesRouter);
  app.use("/contratos", authenticate, resolveTenant("PROCESSOS"), contratosRouter);
  app.use("/solicitacoes", authenticate, resolveTenant("PROCESSOS"), solicitacoesRouter);
  app.use("/processos", authenticate, resolveTenant("PROCESSOS"), processosRouter);

  app.use(errorHandler);
  return app;
};
