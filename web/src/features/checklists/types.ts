export const ALVOS = [
  "PROCESSO", "CONTRATO", "LICITACAO", "ATA", "FORNECEDOR", "BEM", "VEICULO",
] as const;

export type ChecklistTarget = (typeof ALVOS)[number];

/**
 * A situação de um item, espelhada do domínio da API.
 *
 * Espelhada, e não inventada: a API deriva a mesma coisa do último ciclo, e um
 * teste amarra as duas listas. Divergirem seria a tela pintar de verde um item
 * que a API considera vencido.
 */
export const SITUACOES = [
  { value: "PENDENTE", label: "pendente", tone: "warning" as const },
  { value: "AGUARDANDO_CONFERENCIA", label: "aguardando conferência", tone: "accent" as const },
  { value: "CUMPRIDO", label: "cumprido", tone: "success" as const },
  // `Badge` não tem tom de erro; `warning` é o mais forte que ele oferece, e
  // o Alert vermelho no topo da tela é quem dá o peso ao vencimento.
  { value: "VENCIDO", label: "vencido", tone: "warning" as const },
  { value: "DISPENSADO", label: "dispensado", tone: "neutral" as const },
];

export type ChecklistCycle = {
  id: string;
  ciclo: number;
  situacao: "AGUARDANDO" | "ACEITO" | "RECUSADO";
  vigenciaAte: string | null;
  cumpridoEm: string;
  cumpridoPorNome: string | null;
  observacao: string | null;
  recusaMotivo: string | null;
  conferidoPorNome: string | null;
  conferidoEm: string | null;
  anexos: { id: string; nomeOriginal: string; tamanhoBytes: number }[];
};

export type ChecklistItem = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  exigeAnexo: boolean;
  prazoLimite: string | null;
  recorrente: boolean;
  periodicidadeDias: number | null;
  setorId: string | null;
  setorNome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  paraFornecedor: boolean;
  dispensadoEm: string | null;
  dispensaMotivo: string | null;
  dispensadoPorNome: string | null;
  ultimoCiclo: ChecklistCycle | null;
  historico: ChecklistCycle[];
};

export type ChecklistSummary = {
  id: string;
  titulo: string;
  alvoTipo: string | null;
  alvoId: string | null;
  criadoEm: string;
  totalItens: number;
  emAberto: number;
};

export type ChecklistDetail = ChecklistSummary & {
  descricao: string | null;
  modeloId: string | null;
  modeloNome: string | null;
  setorId: string | null;
  setorNome: string | null;
  departamentoId: string | null;
  departamentoNome: string | null;
  criadoPorNome: string | null;
  itens: ChecklistItem[];
};

export type ChecklistTemplateItem = {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  exigeAnexo: boolean;
  prazoDias: number | null;
  recorrente: boolean;
  periodicidadeDias: number | null;
  setorId: string | null;
  departamentoId: string | null;
  paraFornecedor: boolean;
};

export type ChecklistTemplate = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  totalItens: number;
};

export type ChecklistTemplateDetail = ChecklistTemplate & {
  itens: ChecklistTemplateItem[];
};
