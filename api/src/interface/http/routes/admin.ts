import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { container } from "../../../container";
import { authenticateAdmin, emitirTokenAdmin } from "../middlewares/authenticateAdmin";
import { enviarArquivo } from "../enviarArquivo";
import { CATALOGO_POR_TIPO } from "../../../domain/documento/Catalogo";
import { limiteDeLogin, limiteGlobal } from "../middlewares/rateLimit";
import { garantirExiste, garantirSemVinculos } from "../../../application/shared/ExclusaoSegura";
import {
  criarSetorSchema, criarUnidadeSchema, criarUsuarioSchema,
  editarSetorSchema, editarUnidadeSchema, editarUsuarioSchema,
} from "../schemas/cadastros";

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

// Sem `arquivoLogomarca`: o caminho no storage é definido pelo upload.
const timbreSchema = z.object({
  cabecalhoTimbre: z.string().nullable().default(null),
  rodapeTimbre: z.string().nullable().default(null),
});

const logomarca = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const primeiroAdminSchema = z.object({
  nome: z.string().min(1).max(150),
  email: z.string().email(),
  username: z.string().regex(/^[a-z0-9._-]{3,40}$/),
  senha: z.string().min(8),
});

const redefinicaoSenhaSchema = z.object({ senha: z.string().min(8) });
const situacaoAdminSchema = z.object({ ativo: z.boolean() });

const adminDoSistemaSchema = z.object({
  nome: z.string().min(1).max(150),
  email: z.string().email(),
  senha: z.string().min(8),
});

export const adminRouter = Router();

adminRouter.post("/login", limiteDeLogin, async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);
    const sessao = await container.administrarSistema.autenticar(email, senha);
    res.json({
      token: emitirTokenAdmin({
        adminId: sessao.adminId,
        nome: sessao.nome,
        email: sessao.email,
        escopo: "SISTEMA",
      }),
      admin: { nome: sessao.nome, email: sessao.email },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.use(authenticateAdmin, limiteGlobal);

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

adminRouter.get("/orgaos/:id/timbre/logomarca", async (req, res, next) => {
  try {
    enviarArquivo(res, await container.administrarSistema.abrirLogomarca(req.params.id!));
  } catch (error) {
    next(error);
  }
});

adminRouter.put(
  "/orgaos/:id/timbre/logomarca",
  logomarca.single("arquivo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(422).json({ message: "Arquivo ausente — envie no campo 'arquivo'" });
        return;
      }
      res.json(
        await container.administrarSistema.enviarLogomarca({
          orgaoId: req.params.id!,
          conteudo: req.file.buffer,
          mimeType: req.file.mimetype,
          nomeOriginal: req.file.originalname,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

// ---- Modelos globais de documento -----------------------------------------
//
// O padrão de cada peça vive aqui. Corrigir a redação alcança de uma vez toda
// prefeitura que não tenha versão própria.

const modeloSchema = z.object({
  nome: z.string().min(1).max(150),
  titulo: z.string().min(1).max(150),
  corpo: z.string().min(1),
  ativo: z.boolean().default(true),
});

adminRouter.get("/modelos", async (_req, res, next) => {
  try {
    res.json(await container.manterModelos.listarGlobais());
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/modelos/:tipo/marcadores", (req, res, next) => {
  try {
    const catalogo = CATALOGO_POR_TIPO[req.params.tipo as keyof typeof CATALOGO_POR_TIPO];
    if (!catalogo) {
      res.status(404).json({ message: "Tipo de documento desconhecido" });
      return;
    }
    res.json(catalogo);
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/modelos/:tipo", async (req, res, next) => {
  try {
    const dados = modeloSchema.parse(req.body);
    res.json(await container.manterModelos.salvarGlobal(req.params.tipo!, dados));
  } catch (error) {
    next(error);
  }
});

// ---- Cadastros da prefeitura, pelo painel do produto -----------------------
//
// Mesmas operações que o ADMIN da prefeitura tem em /unidades, /setores e
// /usuarios, com o órgão vindo da URL em vez do token. Serve para o suporte
// destravar cliente sem pedir a senha de ninguém.

/** 404 antes de qualquer escrita: id de órgão inválido não pode virar registro órfão. */
const exigirOrgao = async (id: string) => {
  garantirExiste(await container.adminSistema.buscarOrgao(id), "Prefeitura");
};

adminRouter.get("/orgaos/:id/unidades", async (req, res, next) => {
  try {
    await exigirOrgao(req.params.id!);
    res.json(await container.organizacao.listar(req.params.id!));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos/:id/unidades", async (req, res, next) => {
  try {
    await exigirOrgao(req.params.id!);
    const dados = criarUnidadeSchema.parse(req.body);
    res.status(201).json({
      id: await container.organizacao.criar({ ...dados, orgaoId: req.params.id! }),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/orgaos/:id/unidades/:unidadeId", async (req, res, next) => {
  try {
    const orgaoId = req.params.id!;
    garantirExiste(await container.organizacao.buscar(orgaoId, req.params.unidadeId!), "Unidade");
    const dados = editarUnidadeSchema.parse(req.body);
    await container.organizacao.atualizar(orgaoId, req.params.unidadeId!, dados);
    res.json({ message: "Unidade atualizada" });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/orgaos/:id/unidades/:unidadeId", async (req, res, next) => {
  try {
    const orgaoId = req.params.id!;
    garantirExiste(await container.organizacao.buscar(orgaoId, req.params.unidadeId!), "Unidade");
    garantirSemVinculos(
      await container.organizacao.contarVinculos(orgaoId, req.params.unidadeId!),
      "Unidade",
    );
    await container.organizacao.remover(orgaoId, req.params.unidadeId!);
    res.json({ message: "Unidade excluída" });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/orgaos/:id/setores", async (req, res, next) => {
  try {
    await exigirOrgao(req.params.id!);
    res.json(await container.organizacao.listarSetores(req.params.id!));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos/:id/setores", async (req, res, next) => {
  try {
    await exigirOrgao(req.params.id!);
    const dados = criarSetorSchema.parse(req.body);
    res.status(201).json({
      id: await container.organizacao.criarSetor({ ...dados, orgaoId: req.params.id! }),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/orgaos/:id/setores/:setorId", async (req, res, next) => {
  try {
    const orgaoId = req.params.id!;
    garantirExiste(await container.organizacao.buscarSetor(orgaoId, req.params.setorId!), "Setor");
    const dados = editarSetorSchema.parse(req.body);
    await container.organizacao.atualizarSetor(orgaoId, req.params.setorId!, dados);
    res.json({ message: "Setor atualizado" });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/orgaos/:id/setores/:setorId", async (req, res, next) => {
  try {
    const orgaoId = req.params.id!;
    garantirExiste(await container.organizacao.buscarSetor(orgaoId, req.params.setorId!), "Setor");
    garantirSemVinculos(
      await container.organizacao.contarVinculosSetor(orgaoId, req.params.setorId!),
      "Setor",
    );
    await container.organizacao.removerSetor(orgaoId, req.params.setorId!);
    res.json({ message: "Setor excluído" });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/orgaos/:id/usuarios", async (req, res, next) => {
  try {
    await exigirOrgao(req.params.id!);
    res.json(await container.usuarios.listar(req.params.id!));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos/:id/usuarios", async (req, res, next) => {
  try {
    await exigirOrgao(req.params.id!);
    const dados = criarUsuarioSchema.parse(req.body);
    res.status(201).json(
      await container.criarUsuario.executar({ ...dados, orgaoId: req.params.id! }),
    );
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/orgaos/:id/usuarios/:usuarioId", async (req, res, next) => {
  try {
    const dados = editarUsuarioSchema.parse(req.body);
    await container.editarUsuario.executar(req.params.id!, req.params.usuarioId!, dados);
    res.json({ message: "Usuário atualizado" });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/orgaos/:id/usuarios/:usuarioId", async (req, res, next) => {
  try {
    await container.editarUsuario.remover(req.params.id!, req.params.usuarioId!);
    res.json({ message: "Usuário excluído" });
  } catch (error) {
    next(error);
  }
});

// ---- Administradores do produto --------------------------------------------

adminRouter.get("/administradores", async (_req, res, next) => {
  try {
    res.json(await container.administrarSistema.listarAdminsDoSistema());
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/administradores", async (req, res, next) => {
  try {
    const dados = adminDoSistemaSchema.parse(req.body);
    res.status(201).json(await container.administrarSistema.criarAdminDoSistema(dados));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/administradores/:id/senha", async (req, res, next) => {
  try {
    const { senha } = redefinicaoSenhaSchema.parse(req.body);
    await container.administrarSistema.redefinirSenhaDeAdminDoSistema(req.params.id!, senha);
    res.json({ message: "Senha redefinida" });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/administradores/:id", async (req, res, next) => {
  try {
    const { ativo } = situacaoAdminSchema.parse(req.body);
    await container.administrarSistema.definirSituacaoDeAdminDoSistema(
      req.params.id!, ativo, req.admin?.adminId,
    );
    res.json({ message: ativo ? "Administrador reativado" : "Administrador inativado" });
  } catch (error) {
    next(error);
  }
});

// ---- Administradores da prefeitura -----------------------------------------

const autor = (req: { admin?: { nome: string; email: string } }) =>
  req.admin ? { nome: req.admin.nome, email: req.admin.email } : undefined;

adminRouter.get("/orgaos/:id/administradores", async (req, res, next) => {
  try {
    res.json(await container.administrarSistema.listarAdministradores(req.params.id!));
  } catch (error) {
    next(error);
  }
});

/** Servidores que ainda não são ADMIN, para promover sem duplicar cadastro. */
adminRouter.get("/orgaos/:id/promoviveis", async (req, res, next) => {
  try {
    res.json(await container.administrarSistema.listarPromoviveis(req.params.id!));
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos/:id/administrador", async (req, res, next) => {
  try {
    const dados = primeiroAdminSchema.parse(req.body);
    res.status(201).json(
      await container.administrarSistema.criarAdministrador(req.params.id!, dados, autor(req)),
    );
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos/:id/administradores/:usuarioId/promover", async (req, res, next) => {
  try {
    await container.administrarSistema.promoverAdministrador(
      req.params.id!, req.params.usuarioId!, autor(req),
    );
    res.json({ message: "Usuário promovido a administrador" });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/orgaos/:id/administradores/:usuarioId/senha", async (req, res, next) => {
  try {
    const { senha } = redefinicaoSenhaSchema.parse(req.body);
    await container.administrarSistema.redefinirSenhaDeAdministrador(
      req.params.id!, req.params.usuarioId!, senha, autor(req),
    );
    res.json({ message: "Senha redefinida" });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/orgaos/:id/administradores/:usuarioId", async (req, res, next) => {
  try {
    const { ativo } = situacaoAdminSchema.parse(req.body);
    await container.administrarSistema.definirSituacaoDeAdministrador(
      req.params.id!, req.params.usuarioId!, ativo, autor(req),
    );
    res.json({ message: ativo ? "Administrador reativado" : "Administrador inativado" });
  } catch (error) {
    next(error);
  }
});
