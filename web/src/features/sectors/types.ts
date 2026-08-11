export const SECTOR_TYPES = [
  "PROTOCOLO",
  "COMPRAS",
  "CONTROLADORIA",
  "ALIMENTACAO_ESCOLAR",
  "FROTAS",
  "PATRIMONIO",
  "OPERACIONAL",
] as const;

export type SectorType = (typeof SECTOR_TYPES)[number];

export type Sector = {
  id: string;
  nome: string;
  tipo: SectorType;
  ativo: boolean;
};

export type Department = {
  id: string;
  nome: string;
  categoriaAtendimento: string | null;
  ativo: boolean;
};
