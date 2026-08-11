import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ErroDeNegocio } from "../../../domain/shared/ErroDeNegocio";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Dados inválidos",
      erros: error.errors.map((e) => ({ campo: e.path.join("."), motivo: e.message })),
    });
    return;
  }
  if (error instanceof ErroDeNegocio) {
    res.status(error.status).json({ message: error.message, contexto: error.contexto });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Erro interno" });
};
