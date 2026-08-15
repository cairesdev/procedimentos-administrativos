import express from "express";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { patrimonioRouter } from "./routes/patrimonio";
import { licitacoesRouter } from "./routes/licitacoes";
import { contratosRouter } from "./routes/contratos";
import { atasRouter } from "./routes/atas";
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

  // Painel do produto: escopo de token próprio, fora do isolamento por órgão.
  app.use("/admin", adminRouter);

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
  app.use("/atas", authenticate, resolveTenant("PROCESSOS"), atasRouter);
  app.use("/contratos", authenticate, resolveTenant("PROCESSOS"), contratosRouter);
  app.use("/solicitacoes", authenticate, resolveTenant("PROCESSOS"), solicitacoesRouter);
  app.use("/processos", authenticate, resolveTenant("PROCESSOS"), processosRouter);

  // Módulo de patrimônio: independente do módulo de processos.
  app.use("/patrimonio", authenticate, resolveTenant("PATRIMONIO"), patrimonioRouter);

  app.use(errorHandler);
  return app;
};
