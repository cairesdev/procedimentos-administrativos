import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { atualizarFornecedorSchema, criarFornecedorSchema } from "../schemas/cadastros";
import { paginacaoSchema } from "../schemas/paginacao";

export const fornecedoresRouter = Router();

// Fornecedor é cadastro global, mas só quem trabalha com contratação o altera.
// Piso do módulo: sem isto, a regra real de cada rota era "tem sessão".
fornecedoresRouter.use(exigirPermissao("suppliers:read"));

fornecedoresRouter.post("/", exigirPermissao("suppliers:write"), async (req, res, next) => {
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

fornecedoresRouter.patch("/:id", exigirPermissao("suppliers:write"), async (req, res, next) => {
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
