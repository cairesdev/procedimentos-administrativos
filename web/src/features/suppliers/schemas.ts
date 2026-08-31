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

/**
 * O que o fornecedor pode corrigir sozinho.
 *
 * Sem `documento`: o CNPJ identifica a empresa nos contratos já assinados, e
 * trocá-lo aqui transformaria o cadastro em outro — levando junto o histórico
 * e os contratos de todas as prefeituras que o usam.
 */
export const supplierSelfServiceSchema = z.object({
  razaoSocial: z.string().min(3, "Informe a razão social").max(200),
  endereco: z.string().max(500).optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]).optional(),
  telefone: z.string().max(20).optional(),
  inscricaoEstadual: z.string().max(30).optional(),
  inscricaoMunicipal: z.string().max(30).optional(),
});

export type SupplierSelfServiceInput = z.infer<typeof supplierSelfServiceSchema>;
