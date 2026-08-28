import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { criarLicitacaoSchema, editarLicitacaoSchema } from "../schemas/processos";
import { paginacaoSchema } from "../schemas/paginacao";

export const licitacoesRouter = Router();

// Licitação e ata são a mesma atribuição: quem registra uma registra a outra.
// Piso do módulo: sem isto, a regra real de cada rota era "tem sessão".
licitacoesRouter.use(exigirPermissao("bids:read"));

licitacoesRouter.post("/", exigirPermissao("bids:write"), async (req, res, next) => {
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
    const licitacoes = await container.licitacoes.listar(req.sessao!.orgaoId, paginacaoSchema.parse(req.query));
    res.json(licitacoes);
  } catch (error) {
    next(error);
  }
});

licitacoesRouter.patch("/:id", exigirPermissao("bids:write"), async (req, res, next) => {
  try {
    const dados = editarLicitacaoSchema.parse(req.body);
    await container.editarLicitacao.executar(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Licitação atualizada" });
  } catch (error) {
    next(error);
  }
});

licitacoesRouter.delete("/:id", exigirPermissao("bids:write"), async (req, res, next) => {
  try {
    await container.editarLicitacao.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Licitação excluída" });
  } catch (error) {
    next(error);
  }
});

/** Detalhe: a licitação e o que ela originou — atas e contratos. */
licitacoesRouter.get("/:id", async (req, res, next) => {
  try {
    const licitacao = await container.licitacoes.buscarCompleta(
      req.sessao!.orgaoId, req.params.id!,
    );
    if (!licitacao) {
      res.status(404).json({ message: "Licitação não encontrada" });
      return;
    }
    res.json(licitacao);
  } catch (error) {
    next(error);
  }
});
