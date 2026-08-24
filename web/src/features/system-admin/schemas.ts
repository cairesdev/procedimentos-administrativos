import { z } from "zod";
import { MODULES } from "./types";

export const tenantSchema = z.object({
  cnpj: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 14, "CNPJ deve ter 14 dígitos"),
  nome: z.string().min(1, "Informe o nome").max(200),
  uf: z.string().length(2, "UF com 2 letras").transform((value) => value.toUpperCase()),
  municipio: z.string().min(1, "Informe o município").max(120),
  endereco: z.string().optional(),
  modulos: z.array(z.enum(MODULES as [string, ...string[]])).default([]),
});

// A logomarca não entra aqui: é arquivo, sobe em requisição própria.
export const letterheadSchema = z.object({
  cabecalhoTimbre: z.string().optional(),
  rodapeTimbre: z.string().optional(),
});

export const firstAdminSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  email: z.email("E-mail inválido"),
  username: z.string().regex(/^[a-z0-9._-]{3,40}$/, "Minúsculas, números, ponto, hífen e underline"),
  senha: z.string().min(8, "Mínimo de 8 caracteres"),
});

export const resetPasswordSchema = z.object({
  senha: z.string().min(8, "Mínimo de 8 caracteres"),
});

export const promoteSchema = z.object({
  usuarioId: z.uuid("Escolha o servidor"),
});

export const systemAdminSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  email: z.email("E-mail inválido"),
  senha: z.string().min(8, "Mínimo de 8 caracteres"),
});

export const tenantUnitSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  sigla: z.string().max(20).optional(),
});

export const tenantSectorSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  tipo: z.string().min(1, "Escolha o tipo"),
});

export const tenantUserSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  email: z.email("E-mail inválido"),
  username: z.string().regex(/^[a-z0-9._-]{3,40}$/, "Minúsculas, números, ponto, hífen e underline"),
  senha: z.string().min(8, "Mínimo de 8 caracteres"),
  papelBase: z.string().min(1, "Escolha o papel"),
});

export const adminLoginSchema = z.object({
  email: z.email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export type TenantInput = z.input<typeof tenantSchema>;
export type LetterheadInput = z.input<typeof letterheadSchema>;
export type FirstAdminInput = z.input<typeof firstAdminSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type PromoteInput = z.input<typeof promoteSchema>;
export type SystemAdminInput = z.input<typeof systemAdminSchema>;
export type TenantUnitInput = z.input<typeof tenantUnitSchema>;
export type TenantSectorInput = z.input<typeof tenantSectorSchema>;
export type TenantUserInput = z.input<typeof tenantUserSchema>;
export type AdminLoginInput = z.input<typeof adminLoginSchema>;
