import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import {
  cancelarSolicitacaoSchema, enviarSolicitacaoSchema, rascunhoSolicitacaoSchema,
} from "../schemas/processos";
import { paginacaoSchema } from "../schemas/paginacao";

export const solicitacoesRouter = Router();

// Piso do módulo: sem isto, a regra real de cada rota era "tem sessão".
solicitacoesRouter.use(exigirPermissao("requests:read"));

solicitacoesRouter.post("/", exigirPermissao("requests:create"), async (req, res, next) => {
  try {
    const dados = rascunhoSolicitacaoSchema.parse(req.body);
    const resultado = await container.montarRascunho.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.put("/:id/itens", exigirPermissao("requests:create"), async (req, res, next) => {
  try {
    const dados = rascunhoSolicitacaoSchema.parse(req.body);
    const resultado = await container.montarRascunho.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      solicitacaoId: req.params.id,
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.post("/:id/enviar", exigirPermissao("requests:create"), async (req, res, next) => {
  try {
    const dados = enviarSolicitacaoSchema.parse(req.body ?? {});
    const resultado = await container.enviarSolicitacao.executar({
      orgaoId: req.sessao!.orgaoId,
      solicitacaoId: req.params.id!,
      usuarioId: req.sessao!.usuarioId,
      setorDestinoId: dados.setorDestinoId,
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.post("/:id/cancelar", exigirPermissao("requests:create"), async (req, res, next) => {
  try {
    const { motivo } = cancelarSolicitacaoSchema.parse(req.body ?? {});
    await container.cancelarSolicitacao.executar({
      orgaoId: req.sessao!.orgaoId,
      solicitacaoId: req.params.id!,
      usuarioId: req.sessao!.usuarioId,
      motivo,
    });
    res.json({ message: "Solicitação cancelada e saldo devolvido aos contratos" });
  } catch (error) {
    next(error);
  }
});

solicitacoesRouter.get("/", async (req, res, next) => {
  try {
    res.json(
      await container.solicitacoes.listar(
        req.sessao!.orgaoId,
        {
          situacao: typeof req.query.situacao === "string" ? req.query.situacao : undefined,
          unidadeId: typeof req.query.unidade === "string" ? req.query.unidade : undefined,
        },
        paginacaoSchema.parse(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Detalhe completo: a solicitação, o processo que ela gerou, cada item com o
 * que veio do contrato e o saldo de hoje, e os contratos de origem com
 * fornecedor e vigência. Quem despacha decide olhando isto.
 */
solicitacoesRouter.get("/:id", async (req, res, next) => {
  try {
    const solicitacao = await container.solicitacoes.buscarCompleta(
      req.sessao!.orgaoId,
      req.params.id!,
    );
    if (!solicitacao) {
      res.status(404).json({ message: "Solicitação não encontrada" });
      return;
    }
    res.json(solicitacao);
  } catch (error) {
    next(error);
  }
});
