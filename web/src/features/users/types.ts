import type { Role } from "@/features/auth/types";

export const ROLES = [
  "ADMIN",
  "GESTOR",
  "SERVIDOR",
  "PROTOCOLO",
  "COMPRAS",
  "CONTROLADORIA",
  "NUTRICIONISTA",
] as const;

export type User = {
  id: string;
  nome: string;
  email: string;
  papelBase: Role;
  ativo: boolean;
};
