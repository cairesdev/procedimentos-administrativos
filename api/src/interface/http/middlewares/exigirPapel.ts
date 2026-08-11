import type { NextFunction, Request, Response } from "express";

export const exigirPapel = (...papeis: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const papel = req.sessao?.papelBase;
    if (!papel || !papeis.includes(papel)) {
      res.status(403).json({ message: `Ação restrita aos papéis: ${papeis.join(", ")}` });
      return;
    }
    next();
  };
