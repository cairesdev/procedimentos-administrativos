import { Router } from "express";
import { container } from "../../../container";
import { atualizarFornecedorSchema, criarFornecedorSchema } from "../schemas/cadastros";
import { paginacaoSchema } from "../schemas/paginacao";

export const fornecedoresRouter = Router();

fornecedoresRouter.post("/", async (req, res, next) => {
  try {
    const dados = criarFornecedorSchema.parse(req.body);
    const resultado = await container.manterFornecedor.criar(dados);
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

fornecedoresRouter.get("/", async (req, res, next) => {
  try {
    const busca = typeof req.query.busca === "string" ? req.query.busca : undefined;
    res.json(await container.fornecedores.listar(paginacaoSchema.parse(req.query), busca));
  } catch (error) {
    next(error);
  }
});

fornecedoresRouter.patch("/:id", async (req, res, next) => {
  try {
    const dados = atualizarFornecedorSchema.parse(req.body);
    await container.manterFornecedor.atualizar(
      req.params.id!,
      dados,
      `usuario:${req.sessao!.usuarioId}`,
    );
    res.json({ message: "Fornecedor atualizado com histórico registrado" });
  } catch (error) {
    next(error);
  }
});
