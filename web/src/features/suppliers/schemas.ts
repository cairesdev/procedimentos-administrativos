import { z } from "zod";

// Cadastro global: o documento é único no sistema inteiro, não por prefeitura.
export const supplierSchema = z.object({
  documento: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 11 || value.length === 14, "CPF (11) ou CNPJ (14) dígitos"),
  razaoSocial: z.string().min(1, "Informe a razão social").max(200),
  endereco: z.string().optional(),
  email: z.email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().max(20).optional(),
  inscricaoEstadual: z.string().max(30).optional(),
  inscricaoMunicipal: z.string().max(30).optional(),
});

export type SupplierInput = z.input<typeof supplierSchema>;
