import type { NextFunction, Request, Response } from "express";
import { pool } from "../../../infrastructure/db/pool";

// O tenant vem do token; o middleware valida que o órgão existe e está ativo.
// Com módulo informado, exige também que ele esteja habilitado para o órgão.
// Rotas organizacionais (unidades, setores, usuários, fluxos) usam sem módulo.
export const resolveTenant = (modulo?: string) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgaoId = req.sessao?.orgaoId;
    if (!orgaoId) {
      res.status(401).json({ message: "Sessão sem órgão" });
      return;
    }
    const { rows } = await pool.query(
      `SELECT o.ativo,
              ($2::text IS NULL OR EXISTS (SELECT 1 FROM orgao_modulo m
                       WHERE m.orgao_id = o.id AND m.modulo = $2 AND m.ativo)) AS "moduloAtivo"
         FROM orgao o
        WHERE o.id = $1`,
      [orgaoId, modulo ?? null],
    );
    const orgao = rows[0];
    if (!orgao?.ativo) {
      res.status(403).json({ message: "Órgão inexistente ou inativo" });
      return;
    }
    if (!orgao.moduloAtivo) {
      res.status(403).json({ message: `Módulo ${modulo} não habilitado para este órgão` });
      return;
    }
    next();
  };
