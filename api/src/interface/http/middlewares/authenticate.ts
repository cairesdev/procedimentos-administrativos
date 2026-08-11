import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env";

export type TokenPayload = {
  usuarioId: string;
  orgaoId: string;
  papelBase: string;
};

declare module "express-serve-static-core" {
  interface Request {
    sessao?: TokenPayload;
  }
}

export const emitirToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: "8h" });

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token ausente" });
    return;
  }
  try {
    req.sessao = jwt.verify(header.slice(7), env.jwtSecret) as TokenPayload;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
};
