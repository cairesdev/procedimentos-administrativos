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

export const MODULES: ModuleName[] = ["PROCESSOS", "FROTAS", "PATRIMONIO", "ALMOXARIFADO"];
