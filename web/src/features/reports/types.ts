export const REPORT_TYPES = ["PANORAMA", "DOSSIE", "SETOR"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** O recorte que a tela manda na URL. Período é obrigatório; o resto, não. */
export type ReportFilters = {
  inicio?: string;
  fim?: string;
  unidade?: string;
  fornecedor?: string;
  modalidade?: string;
  setor?: string;
};

export type PanoramaContract = {
  id: string;
  numero: string;
  fornecedor: string;
  objeto: string;
  dataInicio: string;
  dataFim: string | null;
  valorContratado: number;
  /**
   * O que já virou solicitação — **não é pagamento**.
   *
   * O sistema registra a ordem de fornecimento, não a liquidação. Chamar isto
   * de "executado" seria mentir num número que vai para a prestação de contas.
   */
  valorPedido: number;
  saldo: number;
};

export type PanoramaBid = {
  id: string;
  numero: string;
  modalidade: string;
  objeto: string;
  dataAssinatura: string;
  valorTotal: number;
  contratos: number;
  valorContratado: number;
};

export type PanoramaSupplier = {
  id: string;
  razaoSocial: string;
  documento: string;
  contratos: number;
  valorContratado: number;
  valorPedido: number;
};

export type PanoramaUnit = {
  id: string;
  nome: string;
  contratos: number;
  processos: number;
  valorPedido: number;
};

export type Panorama = {
  totais: {
    licitacoes: number;
    contratos: number;
    fornecedores: number;
    valorContratado: number;
    valorPedido: number;
    saldo: number;
  };
  contratos: PanoramaContract[];
  licitacoes: PanoramaBid[];
  fornecedores: PanoramaSupplier[];
  unidades: PanoramaUnit[];
};

export type SectorRow = {
  id: string;
  nome: string;
  entraram: number;
  sairam: number;
  /** Quantos estão no setor **agora** — não depende do período. */
  parados: number;
  diasMedia: number;
  diasMaisAntigo: number;
};

export type BySector = {
  totais: { entraram: number; sairam: number; parados: number };
  setores: SectorRow[];
};
