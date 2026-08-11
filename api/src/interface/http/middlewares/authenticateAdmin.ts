import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env";

export type AdminTokenPayload = { adminId: string; escopo: "SISTEMA" };

declare module "express-serve-static-core" {
  interface Request {
    admin?: AdminTokenPayload;
  }
}

export const emitirTokenAdmin = (payload: AdminTokenPayload): string =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: "8h" });

// Escopo separado do token dos servidores: um não vale pelo outro.
export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token ausente" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as AdminTokenPayload;
    if (payload.escopo !== "SISTEMA") {
      res.status(403).json({ message: "Token não é de administrador do sistema" });
      return;
    }
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
};
