import { Router } from "express";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";
import { criarUsuarioSchema, editarUsuarioSchema } from "../schemas/cadastros";

export const usuariosRouter = Router();

usuariosRouter.post("/", exigirPapel("ADMIN"), async (req, res, next) => {
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

usuariosRouter.get("/", exigirPapel("ADMIN", "GESTOR"), async (req, res, next) => {
  try {
    res.json(await container.usuarios.listar(req.sessao!.orgaoId));
  } catch (error) {
    next(error);
  }
});

usuariosRouter.patch("/:id", exigirPapel("ADMIN"), async (req, res, next) => {
  try {
    const dados = editarUsuarioSchema.parse(req.body);
    await container.editarUsuario.executar(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Usuário atualizado" });
  } catch (error) {
    next(error);
  }
});

usuariosRouter.delete("/:id", exigirPapel("ADMIN"), async (req, res, next) => {
  try {
    await container.editarUsuario.remover(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Usuário excluído" });
  } catch (error) {
    next(error);
  }
});
