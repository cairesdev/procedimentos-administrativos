export const DOCUMENT_TYPES = [
  "TERMO_AUTORIZACAO",
  "DESPACHO",
  "DESPACHO_FISCAL",
  "RELATORIO_CONTROLADORIA",
  "PARECER",
  "ORDEM_FORNECIMENTO",
  "COMPROVANTE_SOLICITACAO",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Modelo em vigor para um tipo, com a origem para a tela mostrar. */
export type DocumentTemplate = {
  id: string;
  orgaoId: string | null;
  modulo: string;
  tipo: DocumentType;
  nome: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
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

/**
 * Tipos que o usuário emite a partir da tela do processo. A referência é o
 * próprio processo; ordem e comprovante saem das telas deles.
 */
export const PROCESS_DOCUMENT_TYPES: DocumentType[] = [
  "TERMO_AUTORIZACAO",
  "DESPACHO",
  "DESPACHO_FISCAL",
  "RELATORIO_CONTROLADORIA",
  "PARECER",
];
