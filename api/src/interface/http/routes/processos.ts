import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { container } from "../../../container";
import { LIMIAR_ALERTA_DIAS } from "../../../domain/shared/Prazos";
import { enviarArquivo } from "../enviarArquivo";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { despacharSchema, ordemFornecimentoSchema, parecerSchema } from "../schemas/tramitacao";
import { paginacaoSchema } from "../schemas/paginacao";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

const anexarSchema = z.object({
  tipoDocumento: z.string().min(1).max(60),
  despachoId: z.string().uuid().optional(),
});

export const processosRouter = Router();

// Piso do módulo: ver o processo. Despachar, opinar e ordenar são atos
// distintos, e cada um declara o seu logo abaixo.
processosRouter.use(exigirPermissao("processes:read"));

processosRouter.get("/", async (req, res, next) => {
  try {
    const setorId = typeof req.query.setor === "string" ? req.query.setor : undefined;
    res.json(
      await container.tramitacao.listarFila(
        req.sessao!.orgaoId, paginacaoSchema.parse(req.query), setorId,
      ),
    );
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
    // O limiar acompanha o processo para a tela pintar o prazo com o mesmo
    // critério da fila, sem repetir o número no front.
    res.json({ ...processo, despachos, limiarAlertaDias: LIMIAR_ALERTA_DIAS });
  } catch (error) {
    next(error);
  }
});

processosRouter.post("/:id/despachos", exigirPermissao("processes:dispatch"), async (req, res, next) => {
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
  exigirPermissao("processes:opinion"),
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

processosRouter.post("/:id/anexos", exigirPermissao("processes:dispatch"), upload.single("arquivo"), async (req, res, next) => {
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
    const { nomeArquivo, ...arquivo } = await container.anexosDeProcesso.baixar(
      req.sessao!.orgaoId,
      req.params.anexoId!,
    );
    enviarArquivo(res, arquivo, { nomeParaDownload: nomeArquivo });
  } catch (error) {
    next(error);
  }
});

processosRouter.delete("/:id/anexos/:anexoId", exigirPermissao("processes:dispatch"), async (req, res, next) => {
  try {
    await container.anexosDeProcesso.remover(
      req.sessao!.orgaoId, req.params.anexoId!, req.sessao!.usuarioId,
    );
    res.json({ message: "Anexo removido" });
  } catch (error) {
    next(error);
  }
});

// Mesma guarda do POST: a ordem é peça de compras, e quem não a emite
// também não precisa da lista para emitir o documento dela.
processosRouter.get(
  "/:id/ordens",
  exigirPermissao("processes:order"),
  async (req, res, next) => {
    try {
      const ordens = await container.tramitacao.listarOrdens(
        req.sessao!.orgaoId,
        req.params.id!,
      );
      res.json(ordens);
    } catch (error) {
      next(error);
    }
  },
);

processosRouter.post(
  "/:id/ordens",
  exigirPermissao("processes:order"),
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
