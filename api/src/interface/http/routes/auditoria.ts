import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";

const filtroSchema = z.object({
  referencia: z.string().uuid().optional(),
  tipo: z.string().max(60).optional(),
  desde: z.string().datetime().optional(),
  ate: z.string().datetime().optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  deslocamento: z.coerce.number().int().min(0).default(0),
});

export const auditoriaRouter = Router();

// Trilha de auditoria: leitura restrita a quem fiscaliza ou administra.
auditoriaRouter.get("/", exigirPapel("ADMIN", "GESTOR", "CONTROLADORIA"), async (req, res, next) => {
  try {
    const filtro = filtroSchema.parse(req.query);
    const registros = await container.auditoria.listar({
      orgaoId: req.sessao!.orgaoId,
      referenciaId: filtro.referencia,
      tipoEvento: filtro.tipo,
      desde: filtro.desde,
      ate: filtro.ate,
      limite: filtro.limite,
      deslocamento: filtro.deslocamento,
    });
    res.json(registros);
  } catch (error) {
    next(error);
  }
});
