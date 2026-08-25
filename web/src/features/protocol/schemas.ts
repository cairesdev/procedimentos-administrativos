import { z } from "zod";

export const subjectSchema = z.object({
  nome: z.string().min(1, "Informe o nome do assunto").max(150),
  descricao: z.string().max(2000).optional(),
  setorId: z.string().optional(),
  prazoDias: z.coerce.number().int().min(1).max(3650).optional(),
  ativo: z.boolean().default(true),
});

export type SubjectInput = z.infer<typeof subjectSchema>;

export const serviceSchema = z.object({
  assuntoId: z.string().uuid("Escolha o assunto"),
  descricaoPedido: z
    .string()
    .min(10, "Descreva o pedido com pelo menos dez caracteres")
    .max(4000),
  tipo: z.enum(["CIDADAO", "FORNECEDOR", "OUTRO_ORGAO", "SERVIDOR"]),
  documento: z.string().min(11, "Informe o CPF ou CNPJ").max(20),
  nome: z.string().min(3, "Informe o nome do requerente").max(200),
  contatoEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  contatoTelefone: z.string().max(20).optional(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export const requirementSchema = z.object({
  texto: z
    .string()
    .min(10, "Descreva a exigência com pelo menos dez caracteres")
    .max(4000),
  prazoDias: z.coerce.number().int().min(1).max(365).optional(),
});

export type RequirementInput = z.infer<typeof requirementSchema>;

export const cancelRequirementSchema = z.object({
  motivo: z.string().min(3, "Explique o motivo").max(500),
});

export type CancelRequirementInput = z.infer<typeof cancelRequirementSchema>;
