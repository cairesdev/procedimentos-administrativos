import type { NextFunction, Request, Response } from "express";
import { permissoesDe, type Permissao } from "../../../domain/shared/Permissoes";
import { pool } from "../../../infrastructure/db/pool";

/**
 * Guarda de rota por permissão, e não por papel.
 *
 * `exigirPapel` obrigava cada rota a repetir a lista de cargos, e por isso
 * ficou em 40 das ~219 rotas: nas outras, a regra real era "tem sessão e a
 * prefeitura contratou o módulo". A tela escondia o botão; a API atendia
 * quem chamasse direto.
 *
 * Aqui a rota declara o que a ação **é** — `stock:manage`, `contracts:write` —
 * e quem pode fazê-la sai da matriz. Papel novo não obriga a revisitar rota
 * nenhuma.
 */

declare module "express-serve-static-core" {
  interface Request {
    /** Permissões já resolvidas nesta requisição. */
    permissoes?: Set<string>;
  }
}

/**
 * Permissões do usuário: o papel, mais as exceções da tabela.
 *
 * As exceções vêm do banco a cada requisição, e não do token: revogar o acesso
 * de alguém não pode esperar as oito horas de validade do JWT dele. O custo é
 * um SELECT por índice numa tabela que, na maioria das prefeituras, está
 * vazia — e o resultado fica preso à requisição, então guardas encadeadas na
 * mesma rota não repetem a ida ao banco.
 */
const permissoesDaRequisicao = async (req: Request): Promise<Set<string>> => {
  if (req.permissoes) return req.permissoes;

  const { rows } = await pool.query(
    "SELECT permissao, concedida FROM usuario_permissao WHERE usuario_id = $1",
    [req.sessao!.usuarioId],
  );
  req.permissoes = permissoesDe(req.sessao!.papelBase, rows);
  return req.permissoes;
};

export const exigirPermissao = (...exigidas: Permissao[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sessao = req.sessao;
    if (!sessao) {
      res.status(401).json({ message: "Sessão ausente" });
      return;
    }

    try {
      const permitidas = await permissoesDaRequisicao(req);

      // Basta uma: uma rota que serve à leitura e à escrita aceita quem tem
      // qualquer das duas, e a regra fina fica no caso de uso.
      if (exigidas.some((permissao) => permitidas.has(permissao))) {
        next();
        return;
      }

      res.status(403).json({
        message: `Seu perfil não tem permissão para esta ação (${exigidas.join(" ou ")})`,
      });
    } catch (error) {
      next(error);
    }
  };
