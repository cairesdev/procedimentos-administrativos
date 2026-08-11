import { z } from "zod";

export const criarUnidadeSchema = z.object({
  nome: z.string().min(1).max(150),
  sigla: z.string().max(20).optional(),
});

export const criarSetorSchema = z.object({
  nome: z.string().min(1).max(150),
  tipo: z.enum([
    "PROTOCOLO", "COMPRAS", "CONTROLADORIA",
    "ALIMENTACAO_ESCOLAR", "FROTAS", "PATRIMONIO", "OPERACIONAL",
  ]),
});

export const criarDepartamentoSchema = z.object({
  nome: z.string().min(1).max(150),
  categoriaAtendimento: z.string().max(100).optional(),
});

export const criarFornecedorSchema = z.object({
  documento: z.string().regex(/^\d{11}$|^\d{14}$/, "CPF (11) ou CNPJ (14) sem máscara"),
  razaoSocial: z.string().min(1).max(200),
  endereco: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().max(20).optional(),
  inscricaoEstadual: z.string().max(30).optional(),
  inscricaoMunicipal: z.string().max(30).optional(),
});

export const atualizarFornecedorSchema = criarFornecedorSchema.omit({ documento: true }).partial();

export const salvarFluxoSchema = z.object({
  permiteOverrideUsuario: z.boolean(),
  etapas: z.array(z.object({
    ordem: z.number().int().positive(),
    setorId: z.string().uuid(),
    departamentoId: z.string().uuid().optional(),
    prazoDias: z.number().int().positive().optional(),
    prazoAtivo: z.boolean().default(false),
    visibilidadeEstendida: z.boolean().default(false),
  })).min(1),
});

const lotacaoSchema = z.object({
  unidadeId: z.string().uuid().optional(),
  setorId: z.string().uuid().optional(),
  departamentoId: z.string().uuid().optional(),
});

export const criarUsuarioSchema = z.object({
  nome: z.string().min(1).max(150),
  email: z.string().email(),
  username: z.string().regex(/^[a-z0-9._-]{3,40}$/, "Minúsculas, números, ponto, hífen e underline; 3 a 40 caracteres"),
  senha: z.string().min(8, "Senha precisa de ao menos 8 caracteres"),
  papelBase: z.enum([
    "ADMIN", "GESTOR", "SERVIDOR", "PROTOCOLO",
    "COMPRAS", "CONTROLADORIA", "NUTRICIONISTA",
  ]),
  lotacoes: z.array(lotacaoSchema).default([]),
});
