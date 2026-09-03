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
  /** Agrupador da tela — a DIMENSÃO da planilha do PNTP. */
  secao: string | null;
  /** Código oficial do critério (`2.2`, `8.5`). Não é a ordem. */
  codigo: string | null;
  classificacao: "OBRIGATORIA" | "ESSENCIAL" | "RECOMENDADA" | null;
  /** O arquivo que quem cumpre baixa, preenche e devolve. */
  modeloArquivo: string | null;
  modeloNomeOriginal: string | null;
  apoios: { setorId: string | null; departamentoId: string | null; nome: string }[];
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
  /** Número do registro vinculado. Nulo se o alvo sumiu. */
  alvoNumero: string | null;
  /** Requerente, fornecedor ou objeto — o que identifica o registro. */
  alvoRotulo: string | null;
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
  /**
   * O setor sugerido pelo modelo, por nome — "CONTABILIDADE COM JURÍDICO".
   *
   * O modelo global não pode apontar para o organograma de uma prefeitura.
   * Ao aplicar, o nome é casado com os setores de quem aplica.
   */
  setorSugerido: string | null;
  /** Agrupador da tela — a DIMENSÃO da planilha do PNTP. */
  secao: string | null;
  /** Código oficial do critério (`2.2`, `8.5`). Não é a ordem. */
  codigo: string | null;
  classificacao: "OBRIGATORIA" | "ESSENCIAL" | "RECOMENDADA" | null;
  /** O arquivo que quem cumpre baixa, preenche e devolve. */
  modeloArquivo: string | null;
  modeloNomeOriginal: string | null;
  apoios: { setorId: string | null; departamentoId: string | null; nome: string }[];
};

export type ChecklistTemplate = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  totalItens: number;
  /** Veio com o sistema — o roteiro do PNTP. Usa-se; para mudar, duplica. */
  global: boolean;
};

export type ChecklistTemplateDetail = ChecklistTemplate & {
  itens: ChecklistTemplateItem[];
};

/**
 * O peso do critério, na linguagem do PNTP.
 *
 * É a obrigatória que o TCE cobra — por isso ela vem primeiro e com o tom mais
 * forte que o `Badge` oferece.
 */
export const CLASSIFICACOES = [
  { value: "OBRIGATORIA", label: "obrigatória", tone: "warning" as const },
  { value: "ESSENCIAL", label: "essencial", tone: "accent" as const },
  { value: "RECOMENDADA", label: "recomendada", tone: "neutral" as const },
];

/** Um registro que o checklist pode acompanhar, como a busca o devolve. */
export type ChecklistTargetOption = {
  tipo: string;
  id: string;
  numero: string;
  rotulo: string;
};
