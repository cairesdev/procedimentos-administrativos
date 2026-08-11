import { Router } from "express";
import { container } from "../../../container";
import { criarContratoSchema } from "../schemas/processos";

export const contratosRouter = Router();

contratosRouter.post("/", async (req, res, next) => {
  try {
    const dados = criarContratoSchema.parse(req.body);
    const resultado = await container.criarContrato.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

contratosRouter.get("/", async (req, res, next) => {
  try {
    const contratos = await container.contratos.listar(req.sessao!.orgaoId);
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
