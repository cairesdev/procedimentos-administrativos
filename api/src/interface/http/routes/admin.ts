import { Router } from "express";
import { z } from "zod";
import { container } from "../../../container";
import { authenticateAdmin, emitirTokenAdmin } from "../middlewares/authenticateAdmin";

const MODULOS = ["PROCESSOS", "FROTAS", "PATRIMONIO", "ALMOXARIFADO"] as const;

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

const orgaoSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 dígitos sem máscara"),
  nome: z.string().min(1).max(200),
  uf: z.string().length(2),
  municipio: z.string().min(1).max(120),
  endereco: z.string().optional(),
  modulos: z.array(z.enum(MODULOS)).default([]),
});

const edicaoOrgaoSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/).optional(),
  nome: z.string().min(1).max(200).optional(),
  uf: z.string().length(2).optional(),
  municipio: z.string().min(1).max(120).optional(),
  endereco: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

const modulosSchema = z.object({ modulos: z.array(z.enum(MODULOS)) });

const timbreSchema = z.object({
  arquivoLogomarca: z.string().max(255).nullable().default(null),
  cabecalhoTimbre: z.string().nullable().default(null),
  rodapeTimbre: z.string().nullable().default(null),
});

const primeiroAdminSchema = z.object({
  nome: z.string().min(1).max(150),
  email: z.string().email(),
  username: z.string().regex(/^[a-z0-9._-]{3,40}$/),
  senha: z.string().min(8),
});

export const adminRouter = Router();

adminRouter.post("/login", async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);
    const sessao = await container.administrarSistema.autenticar(email, senha);
    res.json({
      token: emitirTokenAdmin({ adminId: sessao.adminId, escopo: "SISTEMA" }),
      admin: { nome: sessao.nome, email: sessao.email },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.use(authenticateAdmin);

adminRouter.get("/orgaos", async (_req, res, next) => {
  try {
    res.json(await container.adminSistema.listarOrgaos());
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos", async (req, res, next) => {
  try {
    const { modulos, ...orgao } = orgaoSchema.parse(req.body);
    res.status(201).json(await container.administrarSistema.criarOrgao(orgao, modulos));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/orgaos/:id", async (req, res, next) => {
  try {
    const dados = edicaoOrgaoSchema.parse(req.body);
    await container.administrarSistema.atualizarOrgao(req.params.id!, dados);
    res.json({ message: "Prefeitura atualizada" });
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/orgaos/:id/modulos", async (req, res, next) => {
  try {
    const { modulos } = modulosSchema.parse(req.body);
    await container.administrarSistema.definirModulos(req.params.id!, modulos);
    res.json({ message: "Módulos atualizados" });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/orgaos/:id/timbre", async (req, res, next) => {
  try {
    res.json(
      (await container.adminSistema.buscarTimbre(req.params.id!)) ?? {
        arquivoLogomarca: null,
        cabecalhoTimbre: null,
        rodapeTimbre: null,
      },
    );
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/orgaos/:id/timbre", async (req, res, next) => {
  try {
    const dados = timbreSchema.parse(req.body);
    await container.administrarSistema.salvarTimbre(req.params.id!, dados);
    res.json({ message: "Timbre salvo" });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos/:id/administrador", async (req, res, next) => {
  try {
    const dados = primeiroAdminSchema.parse(req.body);
    res.status(201).json(
      await container.administrarSistema.criarPrimeiroAdmin(req.params.id!, dados),
    );
  } catch (error) {
    next(error);
  }
});
