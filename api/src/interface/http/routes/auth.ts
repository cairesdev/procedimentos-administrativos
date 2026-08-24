import { Router } from "express";
import { container } from "../../../container";
import { enviarArquivo } from "../enviarArquivo";
import { authenticate, emitirToken } from "../middlewares/authenticate";
import { limiteDeLogin } from "../middlewares/rateLimit";
import { loginSchema } from "../schemas/processos";

export const authRouter = Router();

authRouter.post("/login", limiteDeLogin, async (req, res, next) => {
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

/**
 * Timbre da própria prefeitura, para o servidor imprimir documento com o
 * cabeçalho dela. O `/admin` configura; aqui é só leitura, do próprio órgão.
 */
authRouter.get("/timbre", authenticate, async (req, res, next) => {
  try {
    res.json(
      (await container.adminSistema.buscarTimbre(req.sessao!.orgaoId)) ?? {
        arquivoLogomarca: null,
        cabecalhoTimbre: null,
        rodapeTimbre: null,
      },
    );
  } catch (error) {
    next(error);
  }
});

/** A imagem em si — o `arquivoLogomarca` é caminho privado no storage. */
authRouter.get("/timbre/logomarca", authenticate, async (req, res, next) => {
  try {
    enviarArquivo(res, await container.administrarSistema.abrirLogomarca(req.sessao!.orgaoId), {
      cacheSegundos: 300,
    });
  } catch (error) {
    next(error);
  }
});
