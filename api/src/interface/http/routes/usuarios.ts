import { Router } from "express";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import {
  criarUsuarioSchema, editarUsuarioSchema, lotacoesDoUsuarioSchema,
} from "../schemas/cadastros";

export const usuariosRouter = Router();

usuariosRouter.use(exigirPermissao("users:read"));

usuariosRouter.post("/", exigirPermissao("users:write"), async (req, res, next) => {
  try {
    const dados = criarUsuarioSchema.parse(req.body);
    const resultado = await container.criarUsuario.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

usuariosRouter.get("/", exigirPermissao("users:read"), async (req, res, next) => {
  try {
    res.json(await container.usuarios.listar(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

usuariosRouter.patch("/:id", exigirPermissao("users:write"), async (req, res, next) => {
  try {
    const dados = editarUsuarioSchema.parse(req.body);
    await container.editarUsuario.executar(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Usuário atualizado" });
  } catch (error) {
    next(error);
  }
});

// A lotação decide o que a pessoa enxerga; corrigi-la não podia exigir
// recadastrar o usuário.
usuariosRouter.put("/:id/lotacoes", exigirPermissao("users:write"), async (req, res, next) => {
  try {
    const { lotacoes } = lotacoesDoUsuarioSchema.parse(req.body);
    await container.editarUsuario.substituirLotacoes(
      req.sessao!.orgaoId, req.params.id!, lotacoes,
    );
    res.json({ message: "Lotação atualizada" });
  } catch (error) {
    next(error);
  }
});

usuariosRouter.delete("/:id", exigirPermissao("users:write"), async (req, res, next) => {
  try {
    await container.editarUsuario.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Usuário excluído" });
  } catch (error) {
    next(error);
  }
});
