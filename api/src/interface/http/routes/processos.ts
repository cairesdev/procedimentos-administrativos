import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPapel } from "../middlewares/exigirPapel";
import { despacharSchema, ordemFornecimentoSchema, parecerSchema } from "../schemas/tramitacao";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const anexarSchema = z.object({
  tipoDocumento: z.string().min(1).max(60),
  despachoId: z.string().uuid().optional(),
});

export const processosRouter = Router();

processosRouter.get("/", async (req, res, next) => {
  try {
    const setorId = typeof req.query.setor === "string" ? req.query.setor : undefined;
    res.json(await container.tramitacao.listarFila(req.sessao!.orgaoId, setorId));
  } catch (error) {
    next(error);
  }
});

processosRouter.get("/:id", async (req, res, next) => {
  try {
    const processo = await container.tramitacao.buscarProcesso(req.sessao!.orgaoId, req.params.id!);
    if (!processo) {
      res.status(404).json({ message: "Processo não encontrado" });
      return;
    }
    const despachos = await container.tramitacao.listarDespachos(processo.id);
    res.json({ ...processo, despachos });
  } catch (error) {
    next(error);
  }
});

processosRouter.post("/:id/despachos", async (req, res, next) => {
  try {
    const dados = despacharSchema.parse(req.body);
    const resultado = await container.despacharProcesso.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      processoId: req.params.id!,
      usuarioId: req.sessao!.usuarioId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

processosRouter.post(
  "/:id/parecer",
  exigirPapel("CONTROLADORIA", "ADMIN"),
  async (req, res, next) => {
    try {
      const dados = parecerSchema.parse(req.body);
      const resultado = await container.emitirParecer.executar({
        ...dados,
        orgaoId: req.sessao!.orgaoId,
        processoId: req.params.id!,
        usuarioId: req.sessao!.usuarioId,
      });
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  },
);

processosRouter.post("/:id/anexos", upload.single("arquivo"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(422).json({ message: "Arquivo ausente — envie no campo 'arquivo'" });
      return;
    }
    const dados = anexarSchema.parse(req.body);
    const resultado = await container.anexosDeProcesso.anexar({
      orgaoId: req.sessao!.orgaoId,
      processoId: req.params.id!,
      usuarioId: req.sessao!.usuarioId,
      tipoDocumento: dados.tipoDocumento,
      despachoId: dados.despachoId,
      nomeOriginal: req.file.originalname,
      conteudo: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

processosRouter.get("/:id/anexos", async (req, res, next) => {
  try {
    res.json(await container.anexosDeProcesso.listar(req.sessao!.orgaoId, req.params.id!));
  } catch (error) {
    next(error);
  }
});

processosRouter.get("/:id/anexos/:anexoId/download", async (req, res, next) => {
  try {
    res.json(await container.anexosDeProcesso.linkDownload(req.sessao!.orgaoId, req.params.anexoId!));
  } catch (error) {
    next(error);
  }
});

processosRouter.delete("/:id/anexos/:anexoId", async (req, res, next) => {
  try {
    await container.anexosDeProcesso.remover(req.sessao!.orgaoId, req.params.anexoId!);
    res.json({ message: "Anexo removido" });
  } catch (error) {
    next(error);
  }
});

processosRouter.post(
  "/:id/ordens",
  exigirPapel("COMPRAS", "ADMIN"),
  async (req, res, next) => {
    try {
      const dados = ordemFornecimentoSchema.parse(req.body);
      const resultado = await container.emitirOrdem.executar({
        ...dados,
        orgaoId: req.sessao!.orgaoId,
        processoId: req.params.id!,
        usuarioId: req.sessao!.usuarioId,
      });
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  },
);
