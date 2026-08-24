export type AssetLocation = {
  id: string;
  codigo: string;
  nome: string;
  unidadeId: string | null;
  ativo: boolean;
  bens: number;
};

export type AssetCategory = {
  id: string;
  nome: string;
  ativo: boolean;
  bens: number;
};

export type AssetIntake = {
  id: string;
  data: string;
  notaFiscal: string | null;
  fornecedorId: string | null;
  bens: number;
};

export type Asset = {
  id: string;
  codigoTombamento: string;
  nome: string;
  categoriaId: string;
  categoriaNome: string;
  localAtualId: string;
  localAtualNome: string;
  estadoConservacao: ConservationState;
  status: string;
};

export type ConservationState = "NOVO" | "BOM" | "DANIFICADO" | "EM_CONSERTO";

export const CONSERVATION_STATES: { value: ConservationState; label: string }[] = [
  { value: "NOVO", label: "Novo" },
  { value: "BOM", label: "Bom" },
  { value: "DANIFICADO", label: "Danificado" },
  { value: "EM_CONSERTO", label: "Em conserto" },
];

export type TransferStatus = "PENDENTE" | "ACEITA" | "RECUSADA";

export type AssetTransfer = {
  id: string;
  bemId: string;
  codigoTombamento: string;
  nomeBem: string;
  localOrigemId: string;
  localOrigemNome: string;
  localDestinoId: string;
  localDestinoNome: string;
  enviadoPor: string;
  dataEnvio: string;
  aceitoPor: string | null;
  dataAceite: string | null;
  status: TransferStatus;
};

export type WriteOffReason = "QUEBRADO" | "DOADO" | "EXTRAVIADO" | "LEILAO" | "OUTRO";

export const WRITE_OFF_REASONS: { value: WriteOffReason; label: string }[] = [
  { value: "QUEBRADO", label: "Quebrado / inservível" },
  { value: "DOADO", label: "Doado" },
  { value: "EXTRAVIADO", label: "Extraviado" },
  { value: "LEILAO", label: "Leilão" },
  { value: "OUTRO", label: "Outro" },
];

export type AssetWriteOff = {
  bemId: string;
  codigoTombamento: string;
  nomeBem: string;
  localNome: string;
  motivo: WriteOffReason;
  observacao: string | null;
  dadaPor: string;
  data: string;
};

export type Inventory = {
  id: string;
  localId: string;
  localNome: string;
  dataInicio: string;
  dataConclusao: string | null;
  status: "ABERTO" | "CONCLUIDO";
  conferidos: number;
  esperados: number;
  divergencias: number;
};

export type InventoryItem = {
  id: string | null;
  bemId: string;
  codigoTombamento: string;
  nome: string;
  estadoRegistrado: ConservationState;
  situacao: "ENCONTRADO" | "NAO_ENCONTRADO" | null;
  estadoObservado: ConservationState | null;
  observacao: string | null;
};

export type InventoryDetail = Inventory & { itens: InventoryItem[] };
