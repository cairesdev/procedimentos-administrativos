import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";
import { paginacaoSchema } from "../schemas/paginacao";

const filtroSchema = z.object({
  referencia: z.string().uuid().optional(),
  tipo: z.string().max(60).optional(),
  desde: z.string().datetime().optional(),
  ate: z.string().datetime().optional(),
});

export const auditoriaRouter = Router();

// Trilha de auditoria: leitura restrita a quem fiscaliza ou administra.
auditoriaRouter.get("/", exigirPapel("ADMIN", "GESTOR", "CONTROLADORIA"), async (req, res, next) => {
  try {
    const filtro = filtroSchema.parse(req.query);
    res.json(
      await container.auditoria.listar({
        ...paginacaoSchema.parse(req.query),
        orgaoId: req.sessao!.orgaoId,
        referenciaId: filtro.referencia,
        tipoEvento: filtro.tipo,
        desde: filtro.desde,
        ate: filtro.ate,
      }),
    );
  } catch (error) {
    next(error);
  }
});
