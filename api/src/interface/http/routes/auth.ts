import { Router } from "express";
import { container } from "../../../container";
import { authenticate, emitirToken } from "../middlewares/authenticate";
import { loginSchema } from "../schemas/processos";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const dados = loginSchema.parse(req.body);
    const sessao = await container.autenticarUsuario.executar(dados.identificador, dados.senha);
    const token = emitirToken({
      usuarioId: sessao.usuarioId,
      orgaoId: sessao.orgaoId,
      papelBase: sessao.papelBase,
    });
    res.json({ token, usuario: { nome: sessao.nome, papelBase: sessao.papelBase } });
  } catch (error) {
    next(error);
  }
});

// Perfil + lotações: o front usa para o seletor de "atuando como".
authRouter.get("/eu", authenticate, async (req, res, next) => {
  try {
    const perfil = await container.usuarios.buscarPerfil(req.sessao!.usuarioId);
    if (!perfil) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }
    res.json(perfil);
  } catch (error) {
    next(error);
  }
});
