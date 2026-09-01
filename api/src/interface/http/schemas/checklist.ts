import { z } from "zod";
import { ALVOS } from "../../../application/checklist/GerenciarChecklist";

/**
 * Um item, no modelo e no checklist.
 *
 * Os dois lados diferem só no prazo: o modelo guarda **dias**, e o checklist
 * guarda a **data** já calculada na aplicação. No modelo, uma data fixa
 * envelheceria junto com ele.
 */
const itemBase = {
  // 500 porque o critério do PNTP é uma pergunta inteira, não um rótulo.
  titulo: z.string().min(1).max(500),
  // A dimensão da planilha: agrupador da tela, texto livre.
  secao: z.string().max(100).nullable().optional(),
  // O código oficial do critério — `2.2`, `8.5`. Não é a ordem.
  codigo: z.string().max(20).nullable().optional(),
  classificacao: z.enum(["OBRIGATORIA", "ESSENCIAL", "RECOMENDADA"]).nullable().optional(),
  // Setores que apoiam sem responder pelo item.
  apoios: z.array(z.object({
    setorId: z.string().uuid().nullable().optional(),
    departamentoId: z.string().uuid().nullable().optional(),
  })).max(10).optional(),
  descricao: z.string().max(2000).nullable().optional(),
  exigeAnexo: z.boolean().default(false),
  recorrente: z.boolean().default(false),
  periodicidadeDias: z.number().int().positive().nullable().optional(),
  setorId: z.string().uuid().nullable().optional(),
  departamentoId: z.string().uuid().nullable().optional(),
  paraFornecedor: z.boolean().default(false),
};

export const itemDeModeloSchema = z.object({
  ...itemBase,
  prazoDias: z.number().int().positive().nullable().optional(),
});

export const itemDeChecklistSchema = z.object({
  ...itemBase,
  prazoLimite: z.string().date().nullable().optional(),
});

export const modeloSchema = z.object({
  nome: z.string().min(1).max(150),
  descricao: z.string().max(2000).nullable().optional(),
  ativo: z.boolean().default(true),
  itens: z.array(itemDeModeloSchema).min(1, "O modelo precisa de ao menos um item"),
});

export const criarChecklistSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
  descricao: z.string().max(2000).nullable().optional(),
  modeloId: z.string().uuid().nullable().optional(),
  alvoTipo: z.enum(ALVOS).nullable().optional(),
  alvoId: z.string().uuid().nullable().optional(),
  setorId: z.string().uuid().nullable().optional(),
  departamentoId: z.string().uuid().nullable().optional(),
  // Ausente quando vem de modelo: os itens são copiados de lá.
  itens: z.array(itemDeChecklistSchema).optional(),
});

export const editarChecklistSchema = z.object({
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(2000).nullable().optional(),
  setorId: z.string().uuid().nullable().optional(),
  departamentoId: z.string().uuid().nullable().optional(),
});

export const itensDoChecklistSchema = z.object({
  itens: z.array(itemDeChecklistSchema).min(1),
});

export const cumprirSchema = z.object({
  observacao: z.string().max(2000).nullable().optional(),
});

export const conferirSchema = z.object({
  aceitar: z.boolean(),
  recusaMotivo: z.string().max(500).nullable().optional(),
});

export const dispensarSchema = z.object({
  motivo: z.string().min(3, "Explique por que o item deixou de ser exigível").max(500),
});

/** Para quem o link foi enviado — texto livre, e só para o registro. */
export const conviteSchema = z.object({
  destinatario: z.string().max(200).nullable().optional(),
});
