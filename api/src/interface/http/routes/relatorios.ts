import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { exigirPermissao } from "../middlewares/exigirPermissao";
import { filtroDaQuery } from "../queryParam";
import { TIPOS_DE_RELATORIO } from "../../../application/relatorio/ApurarRelatorioDeProcessos";

export const relatoriosRouter = Router();

/**
 * Relatório é leitura de gestão — o conjunto, não um registro.
 *
 * `contracts:read` autoriza ver *um* contrato, e quem o tem em mãos precisa
 * dele. Saber quanto a prefeitura contratou no ano e onde o processo trava é
 * outra pergunta, e nem todo mundo que lê um contrato responde por ela.
 */
relatoriosRouter.use(exigirPermissao("reports:read"));

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

const recorteSchema = z.object({
  tipo: z.enum(TIPOS_DE_RELATORIO),
  periodoInicio: DATA,
  periodoFim: DATA,
  unidadeId: z.string().uuid().nullable().optional(),
  fornecedorId: z.string().uuid().nullable().optional(),
  modalidade: z.string().max(30).nullable().optional(),
  setorId: z.string().uuid().nullable().optional(),
});

/**
 * Os filtros vêm da query, e não de um registro salvo.
 *
 * A tela apura direto do que está na URL: assim o relatório pode ser
 * recarregado, compartilhado por link e refeito amanhã com os números de
 * amanhã. Só quem vai emitir a peça grava o recorte, porque aí é preciso um
 * registro para o documento apontar.
 */
const filtrosDaQuery = (req: Parameters<typeof filtroDaQuery>[0]) => ({
  periodoInicio: filtroDaQuery(req, "inicio") ?? "",
  periodoFim: filtroDaQuery(req, "fim") ?? "",
  unidadeId: filtroDaQuery(req, "unidade") ?? null,
  fornecedorId: filtroDaQuery(req, "fornecedor") ?? null,
  modalidade: filtroDaQuery(req, "modalidade") ?? null,
  setorId: filtroDaQuery(req, "setor") ?? null,
});

const periodoSchema = z.object({
  periodoInicio: DATA,
  periodoFim: DATA,
});

relatoriosRouter.get("/panorama", async (req, res, next) => {
  try {
    const filtros = filtrosDaQuery(req);
    periodoSchema.parse(filtros);
    res.json(await container.relatoriosDeProcessos.panorama(req.sessao!.orgaoId, filtros));
  } catch (error) {
    next(error);
  }
});

relatoriosRouter.get("/setor", async (req, res, next) => {
  try {
    const filtros = filtrosDaQuery(req);
    periodoSchema.parse(filtros);
    res.json(await container.relatoriosDeProcessos.porSetor(req.sessao!.orgaoId, filtros));
  } catch (error) {
    next(error);
  }
});

// Achar o processo pelo número — o dossiê é de um por vez.
relatoriosRouter.get("/processos", async (req, res, next) => {
  try {
    res.json(await container.relatoriosDeProcessos.buscarProcessos(
      req.sessao!.orgaoId, filtroDaQuery(req, "busca") ?? "",
    ));
  } catch (error) {
    next(error);
  }
});

relatoriosRouter.get("/dossie/:processoId", async (req, res, next) => {
  try {
    res.json(await container.relatoriosDeProcessos.dossie(
      req.sessao!.orgaoId, req.params.processoId!,
    ));
  } catch (error) {
    next(error);
  }
});

// Guarda a pergunta para o documento poder apontar para ela. Nunca a resposta.
relatoriosRouter.post("/", async (req, res, next) => {
  try {
    const { tipo, ...filtros } = recorteSchema.parse(req.body);
    res.status(201).json(await container.relatoriosDeProcessos.salvarRecorte({
      orgaoId: req.sessao!.orgaoId,
      usuarioId: req.sessao!.usuarioId,
      tipo,
      filtros,
    }));
  } catch (error) {
    next(error);
  }
});

relatoriosRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await container.relatoriosDeProcessos.buscarRecorte(
      req.sessao!.orgaoId, req.params.id!,
    ));
  } catch (error) {
    next(error);
  }
});
