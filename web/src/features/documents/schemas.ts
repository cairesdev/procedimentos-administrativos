import { z } from "zod";

export const templateSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  titulo: z.string().min(1, "Informe o título impresso").max(150),
  corpo: z.string().min(1, "O corpo do modelo está vazio"),
  ativo: z.boolean().default(true),
});

export type TemplateInput = z.infer<typeof templateSchema>;

export const newTemplateSchema = templateSchema.extend({
  escopo: z.enum(["PROCESSO", "PROCESSO_CONTRATO", "ORDEM_FORNECIMENTO", "SOLICITACAO"]),
});

export type NewTemplateInput = z.infer<typeof newTemplateSchema>;

export const cancelDocumentSchema = z.object({
  motivo: z.string().min(3, "Explique o motivo").max(500),
});

export type CancelDocumentInput = z.infer<typeof cancelDocumentSchema>;
