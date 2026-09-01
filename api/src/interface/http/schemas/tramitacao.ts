import { z } from "zod";

export const despacharSchema = z.object({
  lotacaoId: z.string().uuid(),
  tipo: z.enum(["ANALISE", "ENCAMINHAMENTO"]),
  texto: z.string().optional(),
  destinoSetorId: z.string().uuid().optional(),
  destinoDepartamentoId: z.string().uuid().optional(),
});

export const parecerSchema = z.object({
  lotacaoId: z.string().uuid(),
  favoravel: z.boolean(),
  justificativa: z.string().optional(),
});

/** Vazio limpa o número: nota lançada na ordem errada acontece. */
export const notaFiscalSchema = z.object({
  numeroNotaFiscal: z.string().max(40).nullable(),
});

export const ordemFornecimentoSchema = z.object({
  lotacaoId: z.string().uuid(),
  contratoId: z.string().uuid(),
  dadosContratante: z.record(z.unknown()).optional(),
  numeroEmpenho: z.string().max(40).optional(),
  numeroRequisicao: z.string().max(40).optional(),
  projetoAtividade: z.string().max(150).optional(),
  elementoDespesa: z.string().max(150).optional(),
  fonteRecurso: z.string().max(100).optional(),
  valor: z.number().positive(),
  numeroParcelas: z.number().int().positive().optional(),
  numeroNotaFiscal: z.string().max(40).optional(),
});
