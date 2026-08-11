import { Router } from "express";
import { container } from "../../../container";
import { criarLicitacaoSchema } from "../schemas/processos";

export const licitacoesRouter = Router();

licitacoesRouter.post("/", async (req, res, next) => {
  try {
    const dados = criarLicitacaoSchema.parse(req.body);
    const resultado = await container.criarLicitacao.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

licitacoesRouter.get("/", async (req, res, next) => {
  try {
    const licitacoes = await container.licitacoes.listar(req.sessao!.orgaoId);
    res.json(licitacoes);
  } catch (error) {
    next(error);
  }
});
