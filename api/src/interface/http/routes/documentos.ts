import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { ESCOPOS, ROTULO_DO_ESCOPO } from "../../../domain/documento/Catalogo";
import { paginacaoSchema } from "../schemas/paginacao";

// O tipo deixou de ser vocabulário fechado: a prefeitura cria os dela. O
// formato acompanha o CHECK da tabela.
const TIPO = z.string().regex(/^[A-Z][A-Z0-9_]{2,39}$/);

const emissaoSchema = z.object({
  tipo: TIPO,
  referenciaId: z.string().uuid(),
  lotacaoId: z.string().uuid().optional(),
});

const modeloSchema = z.object({
  nome: z.string().min(1).max(150),
  titulo: z.string().min(1).max(150),
  corpo: z.string().min(1),
  ativo: z.boolean().default(true),
});

const novoModeloSchema = modeloSchema.extend({ escopo: z.enum(ESCOPOS) });

const cancelamentoSchema = z.object({ motivo: z.string().min(3).max(500) });

export const documentosRouter = Router();

/** Tipos disponíveis com o modelo em vigor — alimenta o botão de emissão. */
documentosRouter.get("/modelos", async (req, res, next) => {
  try {
    const modulo = typeof req.query.modulo === "string" ? req.query.modulo : undefined;
    res.json(await container.manterModelos.listarParaOrgao(req.sessao!.orgaoId, modulo));
  } catch (error) {
    next(error);
  }
});

/** Escopos disponíveis, para a tela de criação oferecer as opções. */
documentosRouter.get("/escopos", (_req, res) => {
  res.json(
    ESCOPOS.map((escopo) => ({
      escopo,
      rotulo: ROTULO_DO_ESCOPO[escopo],
      marcadores: container.manterModelos.catalogoDe(escopo),
    })),
  );
});

/** Peça nova, criada pelo administrador da prefeitura. */
documentosRouter.post("/modelos", async (req, res, next) => {
  try {
    const dados = novoModeloSchema.parse(req.body);
    res.status(201).json(
      await container.manterModelos.criarPersonalizado(req.sessao!.orgaoId, dados),
    );
  } catch (error) {
    next(error);
  }
});

/** Catálogo de marcadores do tipo, para a tela de edição listar o que existe. */
documentosRouter.get("/modelos/:tipo/marcadores", async (req, res, next) => {
  try {
    res.json(await container.manterModelos.catalogoDoTipo(req.sessao!.orgaoId, req.params.tipo!));
  } catch (error) {
    next(error);
  }
});

documentosRouter.get("/modelos/:tipo", async (req, res, next) => {
  try {
    res.json(await container.manterModelos.resolver(req.sessao!.orgaoId, req.params.tipo!));
  } catch (error) {
    next(error);
  }
});

// Editar o modelo é ato de administração da prefeitura, não de quem despacha.
documentosRouter.put("/modelos/:tipo", async (req, res, next) => {
  try {
    const dados = modeloSchema.parse(req.body);
    res.json(
      await container.manterModelos.salvarDaPrefeitura(
        req.sessao!.orgaoId, req.params.tipo!, dados,
      ),
    );
  } catch (error) {
    next(error);
  }
});

documentosRouter.delete("/modelos/:tipo", async (req, res, next) => {
  try {
    await container.manterModelos.restaurarPadrao(req.sessao!.orgaoId, req.params.tipo!);
    res.json({ message: "Modelo padrão restaurado" });
  } catch (error) {
    next(error);
  }
});

/** Excluir de vez — só peça criada pela própria prefeitura. */
documentosRouter.delete("/modelos/:tipo/excluir", async (req, res, next) => {
  try {
    await container.manterModelos.excluirPersonalizado(req.sessao!.orgaoId, req.params.tipo!);
    res.json({ message: "Documento excluído" });
  } catch (error) {
    next(error);
  }
});

documentosRouter.post("/", async (req, res, next) => {
  try {
    const dados = emissaoSchema.parse(req.body);
    const resultado = await container.emitirDocumento.executar({
      ...dados,
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
    });
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

documentosRouter.get("/", async (req, res, next) => {
  try {
    const referencia = typeof req.query.referencia === "string" ? req.query.referencia : undefined;
    if (referencia) {
      res.json(await container.documentos.listarPorReferencia(req.sessao!.orgaoId, referencia));
      return;
    }
    res.json(
      await container.documentos.listarEmitidos(
        req.sessao!.orgaoId, paginacaoSchema.parse(req.query),
      ),
    );
  } catch (error) {
    next(error);
  }
});

documentosRouter.get("/:id", async (req, res, next) => {
  try {
    const documento = await container.documentos.buscarEmitido(
      req.sessao!.orgaoId, req.params.id!,
    );
    if (!documento) {
      res.status(404).json({ message: "Documento não encontrado" });
      return;
    }
    res.json(documento);
  } catch (error) {
    next(error);
  }
});

documentosRouter.post("/:id/cancelar", async (req, res, next) => {
  try {
    const { motivo } = cancelamentoSchema.parse(req.body);
    await container.emitirDocumento.cancelar({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      documentoId: req.params.id!,
      motivo,
    });
    res.json({ message: "Documento cancelado" });
  } catch (error) {
    next(error);
  }
});
