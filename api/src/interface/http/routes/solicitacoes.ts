import { Router } from "express";
import { container } from "../../../container";
import { enviarSolicitacaoSchema, rascunhoSolicitacaoSchema } from "../schemas/processos";

export const solicitacoesRouter = Router();

solicitacoesRouter.post("/", async (req, res, next) => {
  try {
    const dados = rascunhoSolicitacaoSchema.parse(req.body);
    const resultado = await container.montarRascunho.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.put("/:id/itens", async (req, res, next) => {
  try {
    const dados = rascunhoSolicitacaoSchema.parse(req.body);
    const resultado = await container.montarRascunho.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      solicitacaoId: req.params.id,
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.post("/:id/enviar", async (req, res, next) => {
  try {
    const dados = enviarSolicitacaoSchema.parse(req.body ?? {});
    const resultado = await container.enviarSolicitacao.executar({
      orgaoId: req.sessao!.orgaoId,
      solicitacaoId: req.params.id!,
      setorDestinoId: dados.setorDestinoId,
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.post("/:id/cancelar", async (req, res, next) => {
  try {
    await container.cancelarSolicitacao.executar(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Solicitação cancelada e saldo devolvido aos contratos" });
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.get("/:id", async (req, res, next) => {
  try {
    const solicitacao = await container.solicitacoes.buscarPorId(req.sessao!.orgaoId, req.params.id!);
    if (!solicitacao) {
      res.status(404).json({ message: "Solicitação não encontrada" });
      return;
    }
    res.json(solicitacao);
  } catch (error) {
    next(error);
  }
});
