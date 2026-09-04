import { filtroDaQuery } from "../queryParam";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { container } from "../../../container";
import { LIMIAR_ALERTA_DIAS } from "../../../domain/shared/Prazos";
import { enviarArquivo } from "../enviarArquivo";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import {
  despacharSchema, notaFiscalSchema, ordemFornecimentoSchema, parecerSchema,
} from "../schemas/tramitacao";
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
    const setorId = filtroDaQuery(req, "setor");
    res.json(
      await container.tramitacao.listarFila(
        req.sessao!.orgaoId, paginacaoSchema.parse(req.query), setorId,
      ),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Encerrados que passaram pelo setor informado.
 *
 * Fica antes de `/:id` de propósito: o Express casa na ordem de registro, e
 * "encerrados" seria lido como um id de processo.
 */
processosRouter.get("/encerrados", async (req, res, next) => {
  try {
    const setorId = filtroDaQuery(req, "setor");
    res.json(
      await container.tramitacao.listarEncerrados(
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

/**
 * Os autos num arquivo só.
 *
 * Vem antes da rota de download de um anexo? Não precisa: os caminhos não se
 * confundem. Mas fica junto delas de propósito — quem procurar "como se baixa
 * arquivo deste processo" acha as duas respostas no mesmo lugar.
 */
processosRouter.get("/:id/autos.zip", async (req, res, next) => {
  try {
    // O endereço público sai da configuração, não do cabeçalho do pedido: o
    // `Host` vem do cliente, e o código de conferência impresso na peça
    // apontaria para onde o cliente mandasse.
    const baseUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

    const { nomeArquivo, conteudo } = await container.baixarOsAutos.montar(
      req.sessao!.orgaoId, req.params.id!, baseUrl,
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Length", conteudo.length);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`,
    );
    res.end(conteudo);
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

/**
 * Ler a ordem não é emitir a ordem.
 *
 * A listagem pedia `processes:order`, a mesma permissão de emitir — e a
 * controladoria, que precisa conferir a ordem para dar parecer no processo,
 * não a via. Quem alcança o processo alcança as ordens dele.
 */
processosRouter.get(
  "/:id/ordens",
  exigirPermissao("processes:read"),
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

// Informar a nota não é emitir a ordem: a controladoria também alcança.
processosRouter.patch(
  "/:id/ordens/:ordemId",
  exigirPermissao("orders:invoice"),
  async (req, res, next) => {
    try {
      const { numeroNotaFiscal } = notaFiscalSchema.parse(req.body);
      await container.informarNotaFiscal.executar({
        orgaoId: req.sessao!.orgaoId,
        usuarioId: req.sessao!.usuarioId,
        ordemId: req.params.ordemId!,
        numero: numeroNotaFiscal,
      });
      res.json({ message: "Nota fiscal registrada" });
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
