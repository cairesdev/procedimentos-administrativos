import { filtroDaQuery } from "../queryParam";
import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { paginacaoSchema } from "../schemas/paginacao";

const TIPOS_DE_REQUERENTE = ["CIDADAO", "FORNECEDOR", "OUTRO_ORGAO", "SERVIDOR"] as const;

const assuntoSchema = z.object({
  nome: z.string().min(1).max(150),
  descricao: z.string().max(2000).optional(),
  setorId: z.string().uuid().optional(),
  prazoDias: z.coerce.number().int().min(1).max(3650).optional(),
  ativo: z.boolean().default(true),
});

const aberturaSchema = z.object({
  assuntoId: z.string().uuid(),
  descricaoPedido: z.string().min(10).max(4000),
  requerente: z.object({
    tipo: z.enum(TIPOS_DE_REQUERENTE),
    // A validação de dígito fica no domínio: aqui só o formato bruto.
    documento: z.string().min(11).max(20),
    nome: z.string().min(3).max(200),
    contatoEmail: z.string().email().optional(),
    contatoTelefone: z.string().max(20).optional(),
  }),
});

export const protocoloRouter = Router();

// Piso do balcão: ver. Atender e administrar assuntos são outros dois atos.
protocoloRouter.use(exigirPermissao("protocol:read"));

// ---- Assuntos: cadastro da prefeitura ---------------------------------------

protocoloRouter.get("/assuntos", async (req, res, next) => {
  try {
    const apenasAtivos = req.query.ativos === "true";
    res.json(await container.protocolo.listarAssuntos(req.sessao!.orgaoId, apenasAtivos));
  } catch (error) {
    next(error);
  }
});

protocoloRouter.post("/assuntos", exigirPermissao("protocol:manage"), async (req, res, next) => {
  try {
    const dados = assuntoSchema.parse(req.body);
    res.status(201).json({
      id: await container.protocolo.criarAssunto({ ...dados, orgaoId: req.sessao!.orgaoId }),
    });
  } catch (error) {
    next(error);
  }
});

protocoloRouter.put("/assuntos/:id", exigirPermissao("protocol:manage"), async (req, res, next) => {
  try {
    const dados = assuntoSchema.parse(req.body);
    await container.protocolo.atualizarAssunto(req.sessao!.orgaoId, req.params.id!, dados);
    res.json({ message: "Assunto atualizado" });
  } catch (error) {
    next(error);
  }
});

protocoloRouter.delete("/assuntos/:id", exigirPermissao("protocol:manage"), async (req, res, next) => {
  try {
    const assunto = await container.protocolo.buscarAssunto(req.sessao!.orgaoId, req.params.id!);
    if (!assunto) {
      res.status(404).json({ message: "Assunto não encontrado" });
      return;
    }
    // Assunto com atendimento não some: os processos dele perderiam a
    // classificação. Desativar tira da lista de abertura sem apagar história.
    if (assunto.atendimentos > 0) {
      res.status(409).json({
        message: `Este assunto já tem ${assunto.atendimentos} atendimento(s) e não pode ser `
          + "excluído. Desative-o para parar de oferecê-lo.",
      });
      return;
    }
    await container.protocolo.removerAssunto(req.sessao!.orgaoId, req.params.id!);
    res.json({ message: "Assunto excluído" });
  } catch (error) {
    next(error);
  }
});

// ---- Balcão -----------------------------------------------------------------

/** Consulta por documento: o atendente reaproveita o cadastro de quem volta. */
protocoloRouter.get("/requerentes/:documento", async (req, res, next) => {
  try {
    const requerente = await container.protocolo.buscarRequerentePorDocumento(
      req.sessao!.orgaoId,
      req.params.documento!.replace(/\D/g, ""),
    );
    if (!requerente) {
      res.status(404).json({ message: "Requerente não cadastrado" });
      return;
    }
    res.json(requerente);
  } catch (error) {
    next(error);
  }
});

protocoloRouter.post(
  "/atendimentos",
  exigirPermissao("protocol:serve"),
  async (req, res, next) => {
    try {
      const dados = aberturaSchema.parse(req.body);
      res.status(201).json(
        await container.atenderProtocolo.abrir({
          ...dados,
          orgaoId: req.sessao!.orgaoId,
          usuarioId: req.sessao!.usuarioId,
          origem: "BALCAO",
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

protocoloRouter.get("/atendimentos", async (req, res, next) => {
  try {
    res.json(
      await container.protocolo.listarAtendimentos(
        req.sessao!.orgaoId,
        { status: filtroDaQuery(req, "status"), assuntoId: filtroDaQuery(req, "assunto"), busca: filtroDaQuery(req, "busca") },
        paginacaoSchema.parse(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
});

/** Detalhe do atendimento, para quem só tem o sistema de protocolo. */
protocoloRouter.get("/atendimentos/:id", async (req, res, next) => {
  try {
    const atendimento = await container.protocolo.buscarAtendimento(
      req.sessao!.orgaoId, req.params.id!,
    );
    if (!atendimento) {
      res.status(404).json({ message: "Atendimento não encontrado" });
      return;
    }
    res.json(atendimento);
  } catch (error) {
    next(error);
  }
});

// ---- Exigência: o setor pergunta --------------------------------------------

const exigenciaSchema = z.object({
  texto: z.string().min(10).max(4000),
  prazoDias: z.coerce.number().int().min(1).max(365).optional(),
});

const cancelamentoSchema = z.object({ motivo: z.string().min(3).max(500) });

protocoloRouter.get("/processos/:processoId/exigencias", async (req, res, next) => {
  try {
    res.json(
      await container.exigirDoRequerente.listar(req.sessao!.orgaoId, req.params.processoId!),
    );
  } catch (error) {
    next(error);
  }
});

protocoloRouter.post("/processos/:processoId/exigencias", exigirPermissao("protocol:serve"), async (req, res, next) => {
  try {
    const dados = exigenciaSchema.parse(req.body);
    res.status(201).json(
      await container.exigirDoRequerente.exigir({
        ...dados,
        orgaoId: req.sessao!.orgaoId,
        processoId: req.params.processoId!,
        usuarioId: req.sessao!.usuarioId,
      }),
    );
  } catch (error) {
    next(error);
  }
});

protocoloRouter.post("/exigencias/:id/cancelar", exigirPermissao("protocol:serve"), async (req, res, next) => {
  try {
    const { motivo } = cancelamentoSchema.parse(req.body);
    await container.exigirDoRequerente.cancelarExigencia({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      exigenciaId: req.params.id!,
      motivo,
    });
    res.json({ message: "Exigência cancelada" });
  } catch (error) {
    next(error);
  }
});
