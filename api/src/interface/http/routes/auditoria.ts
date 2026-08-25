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

// Trilha de auditoria: só o ADMIN da prefeitura. A trilha mostra o que cada
// servidor fez, em todos os módulos — é registro de conduta, não relatório
// operacional, e ver o trabalho alheio não é atribuição de gestor nem de
// controladoria.
auditoriaRouter.get("/", exigirPapel("ADMIN"), async (req, res, next) => {
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
