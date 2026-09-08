import { z } from "zod";
import { PAPEIS, TIPOS_DE_SETOR } from "../../../domain/shared/Papeis";

export const criarUnidadeSchema = z.object({
  nome: z.string().min(1).max(150),
  sigla: z.string().max(20).optional(),
});

export const criarSetorSchema = z.object({
  nome: z.string().min(1).max(150),
  tipo: z.enum(TIPOS_DE_SETOR),
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
  /** Escola, creche ou posto: é ela que trava o almoxarifado. */
  localId: z.string().uuid().optional(),
});

/**
 * A lotação passa a ser corrigível.
 *
 * Antes ela só entrava na criação: quem cadastrasse a diretora na escola
 * errada não tinha como consertar pela tela — e o vínculo é justamente o que
 * decide o que ela enxerga.
 */
export const lotacoesDoUsuarioSchema = z.object({
  lotacoes: z.array(lotacaoSchema),
});

/**
 * O conselho profissional, quando o papel é clínico.
 *
 * Os três andam juntos ou nenhum anda — é o mesmo CHECK que o banco impõe.
 * Conselho sem UF não identifica ninguém: CRM 1234 existe em 27 estados.
 */
const conselhoSchema = {
  /**
   * Os seis conselhos que o banco aceita desde a 0049.
   *
   * O schema tinha ficado em CRM e COREN, de quando o módulo só conhecia o
   * pronto atendimento: o fonoaudiólogo do programa levava 400 na camada HTTP
   * por um valor que o `CHECK` da tabela aprovava. Divergência entre schema e
   * banco só aparece no dia em que alguém tenta usar o que o banco permite.
   */
  conselhoTipo: z.enum(["CRM", "COREN", "CRFA", "CREFITO", "CRP", "OUTRO"]).nullish(),
  conselhoNumero: z.string().trim().max(20).nullish(),
  conselhoUf: z.string().trim().length(2).nullish(),
};

const conselhoCompleto = <T extends {
  conselhoTipo?: unknown; conselhoNumero?: unknown; conselhoUf?: unknown;
}>(dados: T): boolean => {
  const informados = [dados.conselhoTipo, dados.conselhoNumero, dados.conselhoUf]
    .filter((valor) => valor !== null && valor !== undefined && valor !== "");
  return informados.length === 0 || informados.length === 3;
};

const MENSAGEM_DO_CONSELHO =
  "Informe tipo, número e UF do conselho — os três juntos, ou nenhum.";

export const criarUsuarioSchema = z.object({
  nome: z.string().min(1).max(150),
  email: z.string().email(),
  username: z.string().regex(/^[a-z0-9._-]{3,40}$/, "Minúsculas, números, ponto, hífen e underline; 3 a 40 caracteres"),
  senha: z.string().min(8, "Senha precisa de ao menos 8 caracteres"),
  papelBase: z.enum(PAPEIS),
  lotacoes: z.array(lotacaoSchema).default([]),
  ...conselhoSchema,
}).refine(conselhoCompleto, { message: MENSAGEM_DO_CONSELHO, path: ["conselhoNumero"] });

export const editarUnidadeSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  sigla: z.string().max(20).nullable().optional(),
  ativo: z.boolean().optional(),
});

export const editarSetorSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  tipo: z.enum(TIPOS_DE_SETOR).optional(),
  ativo: z.boolean().optional(),
});

export const editarDepartamentoSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  categoriaAtendimento: z.string().max(100).nullable().optional(),
  ativo: z.boolean().optional(),
});

export const editarUsuarioSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  email: z.string().email().optional(),
  papelBase: z.enum(PAPEIS).optional(),
  senha: z.string().min(8).optional(),
  ativo: z.boolean().optional(),
  ...conselhoSchema,
}).refine(conselhoCompleto, { message: MENSAGEM_DO_CONSELHO, path: ["conselhoNumero"] });
