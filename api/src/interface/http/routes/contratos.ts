import { Router } from "express";
import { container } from "../../../container";
import { criarContratoSchema, editarContratoSchema } from "../schemas/processos";
import { paginacaoSchema } from "../schemas/paginacao";

export const contratosRouter = Router();

contratosRouter.post("/", async (req, res, next) => {
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
    const contratos = await container.contratos.listar(req.sessao!.orgaoId, paginacaoSchema.parse(req.query));
    res.json(contratos);
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

contratosRouter.patch("/:id", async (req, res, next) => {
  try {
    const dados = editarContratoSchema.parse(req.body);
    await container.editarContrato.executar(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Contrato atualizado" });
  } catch (error) {
    next(error);
  }
});

contratosRouter.delete("/:id", async (req, res, next) => {
  try {
    await container.editarContrato.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Contrato excluído e processo cancelado" });
  } catch (error) {
    next(error);
  }
});
