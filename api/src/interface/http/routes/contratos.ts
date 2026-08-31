import { filtroDaQuery } from "../queryParam";
import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { criarContratoSchema, editarContratoSchema } from "../schemas/processos";
import { paginacaoSchema } from "../schemas/paginacao";

export const contratosRouter = Router();

// Piso do módulo: sem isto, a regra real de cada rota era "tem sessão".
contratosRouter.use(exigirPermissao("contracts:read"));

contratosRouter.post("/", exigirPermissao("contracts:write"), async (req, res, next) => {
  try {
    const dados = criarContratoSchema.parse(req.body);
    const resultado = await container.criarContrato.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

contratosRouter.get("/", async (req, res, next) => {
  try {
    res.json(
      await container.contratos.listar(
        req.sessao!.orgaoId,
        paginacaoSchema.parse(req.query),
        { unidadeId: filtroDaQuery(req, "unidade") },
      ),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Contratos que a unidade pode usar ao montar uma solicitação: vigentes, com
 * item em saldo e destinados a ela. A tela pede este recorte antes de mostrar
 * item nenhum — oferecer contrato de outra unidade só adiava o erro para o
 * momento do envio.
 */
contratosRouter.get("/para-solicitacao", async (req, res, next) => {
  try {
    const unidadeId = filtroDaQuery(req, "unidade");
    res.json(await container.contratos.listarParaSolicitacao(req.sessao!.orgaoId, unidadeId));
  } catch (error) {
    next(error);
  }
});

/** Detalhe do contrato: itens, unidades destinadas e a origem. */
contratosRouter.get("/:id", async (req, res, next) => {
  try {
    const contrato = await container.contratos.buscarCompleto(
      req.sessao!.orgaoId, req.params.id!,
    );
    if (!contrato) {
      res.status(404).json({ message: "Contrato não encontrado" });
      return;
    }
    res.json(contrato);
  } catch (error) {
    next(error);
  }
});

// Base para montar a solicitação: itens com saldo disponível.
contratosRouter.get("/:id/itens", async (req, res, next) => {
  try {
    const itens = await container.contratos.listarItens(req.sessao!.orgaoId, req.params.id!);
    res.json(itens);
  } catch (error) {
    next(error);
  }
});

contratosRouter.patch("/:id", exigirPermissao("contracts:write"), async (req, res, next) => {
  try {
    const dados = editarContratoSchema.parse(req.body);
    await container.editarContrato.executar(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Contrato atualizado" });
  } catch (error) {
    next(error);
  }
});

contratosRouter.delete("/:id", exigirPermissao("contracts:write"), async (req, res, next) => {
  try {
    await container.editarContrato.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Contrato excluído e processo cancelado" });
  } catch (error) {
    next(error);
  }
});
