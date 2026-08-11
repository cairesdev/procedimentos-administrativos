import { z } from "zod";

export const dispatchSchema = z.object({
  lotacaoId: z.uuid("Selecione a lotação com que você está atuando"),
  tipo: z.enum(["ANALISE", "ENCAMINHAMENTO"]),
  texto: z.string().max(4000).optional(),
  destinoSetorId: z.string().optional(),
});

export const opinionSchema = z.object({
  lotacaoId: z.uuid("Selecione a lotação com que você está atuando"),
  favoravel: z.enum(["sim", "nao"]),
  justificativa: z.string().max(4000).optional(),
});

export const supplyOrderSchema = z.object({
  lotacaoId: z.uuid("Selecione a lotação com que você está atuando"),
  contratoId: z.uuid("Selecione o contrato"),
  valor: z.coerce.number<number>().positive("Informe o valor"),
  numeroEmpenho: z.string().max(40).optional(),
  numeroRequisicao: z.string().max(40).optional(),
  projetoAtividade: z.string().max(150).optional(),
  elementoDespesa: z.string().max(150).optional(),
  fonteRecurso: z.string().max(100).optional(),
  numeroParcelas: z.coerce.number<number>().int().positive().optional(),
  numeroNotaFiscal: z.string().max(40).optional(),
});

export type DispatchInput = z.input<typeof dispatchSchema>;
export type OpinionInput = z.input<typeof opinionSchema>;
export type SupplyOrderInput = z.input<typeof supplyOrderSchema>;
