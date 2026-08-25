import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { paginacaoSchema } from "../schemas/paginacao";

const itemSchema = z.object({
  produto: z.string().min(1).max(150),
  descricao: z.string().optional(),
  unidadeMedida: z.string().min(1).max(20),
  marca: z.string().max(100).optional(),
  quantidade: z.number().positive(),
  valorUnitario: z.number().nonnegative(),
  valorTotal: z.number().positive(),
});

const editarAtaSchema = z.object({
  numero: z.string().min(1).max(40).optional(),
  licitacaoId: z.string().uuid().nullable().optional(),
  objeto: z.string().min(1).optional(),
  dataAssinatura: z.string().date().optional(),
  dataVigencia: z.string().date().optional(),
  valorTotal: z.number().positive().optional(),
  itens: z.array(itemSchema).min(1).optional(),
});

const criarAtaSchema = z.object({
  numero: z.string().min(1).max(40),
  licitacaoId: z.string().uuid().optional(),
  objeto: z.string().min(1),
  dataAssinatura: z.string().date(),
  dataVigencia: z.string().date(),
  valorTotal: z.number().positive(),
  itens: z.array(itemSchema).min(1),
});

export const atasRouter = Router();

atasRouter.post("/", async (req, res, next) => {
  try {
    const dados = criarAtaSchema.parse(req.body);
    const resultado = await container.criarAta.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

atasRouter.get("/", async (req, res, next) => {
  try {
    res.json(await container.atas.listar(req.sessao!.orgaoId, paginacaoSchema.parse(req.query)));
  } catch (error) {
    next(error);
  }
});

/** Detalhe: itens, licitação de origem e contratos gerados a partir dela. */
atasRouter.get("/:id", async (req, res, next) => {
  try {
    const ata = await container.atas.buscarCompleta(req.sessao!.orgaoId, req.params.id!);
    if (!ata) {
      res.status(404).json({ message: "Ata não encontrada" });
      return;
    }
    res.json(ata);
  } catch (error) {
    next(error);
  }
});

// Itens da ata: base para copiar ao criar o contrato.
atasRouter.get("/:id/itens", async (req, res, next) => {
  try {
    res.json(await container.atas.listarItens(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

atasRouter.patch("/:id", async (req, res, next) => {
  try {
    const dados = editarAtaSchema.parse(req.body);
    await container.editarAta.executar(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Ata atualizada" });
  } catch (error) {
    next(error);
  }
});

atasRouter.delete("/:id", async (req, res, next) => {
  try {
    await container.editarAta.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Ata excluída" });
  } catch (error) {
    next(error);
  }
});
