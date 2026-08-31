import { filtroDaQuery } from "../queryParam";
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
    const busca = filtroDaQuery(req, "busca");
    res.json(await container.fornecedores.listar(paginacaoSchema.parse(req.query), busca));
  } catch (error) {
    next(error);
  }
});

/**
 * Link para o fornecedor completar o próprio cadastro.
 *
 * O token volta **uma vez só**: o banco guarda o hash. Perdido o link, gera-se
 * outro — e o anterior morre junto, para não haver dois vivos ao mesmo tempo.
 */
fornecedoresRouter.post(
  "/:id/convite",
  exigirPermissao("suppliers:write"),
  async (req, res, next) => {
    try {
      res.status(201).json(await container.convidarFornecedor.convidar({
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        fornecedorId: req.params.id!,
      }));
    } catch (error) {
      next(error);
    }
  },
);

fornecedoresRouter.get("/:id/convite", async (req, res, next) => {
  try {
    res.json(
      await container.convidarFornecedor.situacao(req.sessao!.orgaoId, req.params.id!),
    );
  } catch (error) {
    next(error);
  }
});

fornecedoresRouter.delete(
  "/:id/convite",
  exigirPermissao("suppliers:write"),
  async (req, res, next) => {
    try {
      await container.convidarFornecedor.revogar({
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        fornecedorId: req.params.id!,
      });
      res.json({ message: "Link revogado" });
    } catch (error) {
      next(error);
    }
  },
);

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
