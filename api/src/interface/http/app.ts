import express from "express";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { patrimonioRouter } from "./routes/patrimonio";
import { frotasRouter } from "./routes/frotas";
import { licitacoesRouter } from "./routes/licitacoes";
import { contratosRouter } from "./routes/contratos";
import { atasRouter } from "./routes/atas";
import { solicitacoesRouter } from "./routes/solicitacoes";
import { processosRouter } from "./routes/processos";
import { auditoriaRouter } from "./routes/auditoria";
import { documentosRouter } from "./routes/documentos";
import { conferenciaRouter } from "./routes/conferencia";
import { protocoloRouter } from "./routes/protocolo";
import { protocoloPublicoRouter } from "./routes/protocoloPublico";
import { setoresRouter, unidadesRouter } from "./routes/organizacao";
import { fornecedoresRouter } from "./routes/fornecedores";
import { fluxosRouter } from "./routes/fluxos";
import { usuariosRouter } from "./routes/usuarios";
import { authenticate } from "./middlewares/authenticate";
import { resolveTenant } from "./middlewares/resolveTenant";
import { errorHandler } from "./middlewares/errorHandler";
import { limiteGlobal } from "./middlewares/rateLimit";

export const criarApp = () => {
  const app = express();

  // A API só recebe conexão do container do Next, que é rede privada. Confiar
  // em proxy fora dessa faixa deixaria qualquer um forjar o IP de origem.
  app.set("trust proxy", "uniquelocal");
  app.use(express.json());

  // O teto por usuário só faz sentido depois de saber quem é: antes do
  // `authenticate` todo mundo cairia no mesmo balde (o IP do container web).
  const sessao = [authenticate, limiteGlobal] as const;

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);

  // Conferência de documento: pública, sem token — é o destino do QR impresso.
  app.use("/conferencia", conferenciaRouter);

  // Portal do cidadão: abertura de pedido sem login, com freios próprios.
  app.use("/publico", protocoloPublicoRouter);

  // Painel do produto: escopo de token próprio, fora do isolamento por órgão.
  app.use("/admin", adminRouter);

  // Cadastros organizacionais: órgão ativo, sem exigência de módulo.
  app.use("/unidades", ...sessao, resolveTenant(), unidadesRouter);
  app.use("/setores", ...sessao, resolveTenant(), setoresRouter);
  app.use("/usuarios", ...sessao, resolveTenant(), usuariosRouter);
  app.use("/fluxos", ...sessao, resolveTenant(), fluxosRouter);
  app.use("/auditoria", ...sessao, resolveTenant(), auditoriaRouter);
  // Documentos atendem todos os módulos, então não exigem módulo específico.
  app.use("/documentos", ...sessao, resolveTenant(), documentosRouter);


  // Fornecedor é cadastro global — autenticação basta.
  app.use("/fornecedores", ...sessao, fornecedoresRouter);

  // Módulo de processos: exige habilitação do módulo para o órgão.
  app.use("/licitacoes", ...sessao, resolveTenant("PROCESSOS"), licitacoesRouter);
  app.use("/atas", ...sessao, resolveTenant("PROCESSOS"), atasRouter);
  app.use("/contratos", ...sessao, resolveTenant("PROCESSOS"), contratosRouter);
  app.use("/solicitacoes", ...sessao, resolveTenant("PROCESSOS"), solicitacoesRouter);
  app.use("/processos", ...sessao, resolveTenant("PROCESSOS"), processosRouter);

  // Módulo de patrimônio: independente do módulo de processos.
  app.use("/patrimonio", ...sessao, resolveTenant("PATRIMONIO"), patrimonioRouter);

  // Protocolo é sistema próprio: quem atende no balcão não precisa do módulo
  // de processos, e o inverso também vale.
  app.use("/protocolo", ...sessao, resolveTenant("PROTOCOLO"), protocoloRouter);
  app.use("/frotas", ...sessao, resolveTenant("FROTAS"), frotasRouter);

  app.use(errorHandler);
  return app;
};
