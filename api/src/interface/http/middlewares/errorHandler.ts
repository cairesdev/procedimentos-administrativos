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
  /**
   * `22P02` é entrada malformada, não falha do servidor.
   *
   * Um id inválido na URL — link velho, id truncado num copiar e colar, o
   * `?local=` que este mesmo commit corrigiu — chegava ao Postgres como
   * `'':: uuid` e voltava ao usuário como "Erro interno", que mente sobre de
   * quem é o problema e não diz o que fazer.
   *
   * O log continua: se a origem for um parâmetro que o **código** montou
   * errado, o 400 escondê-lo-ia da tela, e o `console.error` é o que sobra
   * para encontrá-lo.
   */
  if (ehIdMalformado(error)) {
    console.error(error);
    res.status(400).json({ message: "Identificador inválido" });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Erro interno" });
};

/** Erro do Postgres para texto que não cabe no tipo da coluna. */
const ehIdMalformado = (error: unknown): boolean =>
  typeof error === "object" && error !== null
  && (error as { code?: string }).code === "22P02";
