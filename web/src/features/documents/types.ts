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
  "DEVOLUCAO_ESTOQUE",
  "RELATORIO_CONSUMO",
  "CHECKLIST",
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
  /** Tipos de setor que alcançam a peça. Vazio = todos, como sempre foi. */
  setores: string[];
};

/**
 * Setores aos quais uma peça pode ser amarrada. Mesmo vocabulário do cadastro
 * de setores — um teste na API recusa divergência.
 */
export const SECTOR_TYPES = [
  { value: "PROTOCOLO", label: "Protocolo" },
  { value: "COMPRAS", label: "Compras" },
  { value: "CONTROLADORIA", label: "Controladoria" },
  { value: "ALIMENTACAO_ESCOLAR", label: "Alimentação escolar" },
  { value: "FROTAS", label: "Frotas" },
  { value: "PATRIMONIO", label: "Patrimônio" },
  { value: "OPERACIONAL", label: "Operacional" },
] as const;

/** Rascunho é peça em revisão: sem data e fora da conferência pública. */
export type DocumentStatus = "RASCUNHO" | "EMITIDO";

export type IssuedDocument = {
  id: string;
  orgaoId: string;
  modulo: string;
  tipo: DocumentType;
  codigo: string;
  titulo: string;
  corpo: string;
  referenciaId: string;
  emitidoPorUsuarioId: string | null;
  emitidoPorNome: string;
  emitidoPorCargo: string;
  situacao: DocumentStatus;
  /** Nula enquanto rascunho: a peça ainda não saiu. */
  data: string | null;
  criadoEm: string;
  /** O texto como o modelo o produziu, para o "voltar ao original". */
  corpoOriginal: string | null;
  editadoEm: string | null;
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


