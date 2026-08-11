import { Router } from "express";
import { container } from "../../../container";
import { criarLicitacaoSchema, editarLicitacaoSchema } from "../schemas/processos";

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

licitacoesRouter.patch("/:id", async (req, res, next) => {
  try {
    const dados = editarLicitacaoSchema.parse(req.body);
    await container.editarLicitacao.executar(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Licitação atualizada" });
  } catch (error) {
    next(error);
  }
});

licitacoesRouter.delete("/:id", async (req, res, next) => {
  try {
    await container.editarLicitacao.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Licitação excluída" });
  } catch (error) {
    next(error);
  }
});
