import type { ModuleName } from "@/features/auth/types";

export type Tenant = {
  id: string;
  cnpj: string;
  nome: string;
  uf: string;
  municipio: string;
  endereco: string | null;
  ativo: boolean;
  modulos: ModuleName[];
  usuarios: number;
};

export type Letterhead = {
  arquivoLogomarca: string | null;
  cabecalhoTimbre: string | null;
  rodapeTimbre: string | null;
};

export type EntityAdmin = {
  id: string;
  nome: string;
  email: string;
  username: string;
  ativo: boolean;
  criadoEm: string;
};

/** Servidor que ainda não é ADMIN e pode ser promovido. */
export type PromotableUser = {
  id: string;
  nome: string;
  email: string;
  papelBase: string;
  ativo: boolean;
};

/** Administrador do produto (não pertence a nenhuma prefeitura). */
export type SystemAdmin = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
};

export type TenantUnit = { id: string; nome: string; sigla: string | null; ativo: boolean };

export type TenantSector = {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
};

export type TenantUser = {
  id: string;
  nome: string;
  email: string;
  papelBase: string;
  ativo: boolean;
};

export const SECTOR_TYPES = [
  "PROTOCOLO", "COMPRAS", "CONTROLADORIA",
  "ALIMENTACAO_ESCOLAR", "FROTAS", "PATRIMONIO", "OPERACIONAL",
];

export const MODULES: ModuleName[] = [
  "PROCESSOS",
  "PROTOCOLO",
  "FROTAS",
  "PATRIMONIO",
  "ALMOXARIFADO",
];
