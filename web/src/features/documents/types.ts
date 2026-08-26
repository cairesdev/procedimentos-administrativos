/**
 * O tipo deixou de ser lista fechada: a prefeitura cria peças próprias. Quem
 * decide os marcadores e a origem dos dados é o escopo.
 */
export type DocumentType = string;

export const DOCUMENT_SCOPES = [
  "PROCESSO",
  "PROCESSO_CONTRATO",
  "ORDEM_FORNECIMENTO",
  "SOLICITACAO",
  "BEM",
  "TRANSFERENCIA_BEM",
  "BAIXA_BEM",
  "INVENTARIO",
  "VIAGEM",
  "MANUTENCAO",
  "SOLICITACAO_ESTOQUE",
  "ENTRADA_ESTOQUE",
] as const;

export type DocumentScope = (typeof DOCUMENT_SCOPES)[number];

export type ScopeOption = {
  escopo: DocumentScope;
  rotulo: string;
  marcadores: MarkerCatalog;
};

/** Escopos cuja referência é o processo — são os emitidos na tela dele. */
export const PROCESS_SCOPES: DocumentScope[] = ["PROCESSO", "PROCESSO_CONTRATO"];

/** Modelo em vigor para um tipo, com a origem para a tela mostrar. */
export type DocumentTemplate = {
  id: string;
  orgaoId: string | null;
  modulo: string;
  tipo: DocumentType;
  escopo: DocumentScope;
  nome: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
  /** Criado pela prefeitura: não há padrão do produto para restaurar. */
  personalizado: boolean;
  atualizadoEm: string;
  origem: "GLOBAL" | "PREFEITURA";
};

export type IssuedDocument = {
  id: string;
  orgaoId: string;
  modulo: string;
  tipo: DocumentType;
  codigo: string;
  titulo: string;
  corpo: string;
  referenciaId: string;
  emitidoPorNome: string;
  emitidoPorCargo: string;
  data: string;
  canceladoEm: string | null;
  canceladoMotivo: string | null;
};

/** O que a página pública mostra — sem nada interno. */
export type DocumentCheck = {
  codigo: string;
  titulo: string;
  corpo: string;
  data: string;
  emitidoPorNome: string;
  emitidoPorCargo: string;
  orgaoNome: string;
  canceladoEm: string | null;
  canceladoMotivo: string | null;
};

export type MarkerCatalog = {
  valores: string[];
  listas: Record<string, string[]>;
};


