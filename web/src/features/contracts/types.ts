export const MEASUREMENT_MODES = ["UNIDADE", "PERCENTUAL", "VALOR"] as const;

export type MeasurementMode = (typeof MEASUREMENT_MODES)[number];

export type Contract = {
  id: string;
  numero: string;
  fornecedorId: string;
  dataInicio: string;
  /** Nulo = vigência indeterminada. */
  dataFim: string | null;
  valorTotal: number;
};

export type ContractItem = {
  id: string;
  produto: string;
  descricao: string | null;
  unidadeMedida: string;
  marca: string | null;
  quantidadeTotal: number;
  saldoDisponivel: number;
  modoMedicao: MeasurementMode;
  valorUnitario: number;
  valorTotal: number;
};

export type CreatedContract = { id: string };

/** Contrato oferecido na montagem da solicitação, já filtrado pela unidade. */
export type ContractForRequest = {
  id: string;
  numero: string;
  fornecedorRazaoSocial: string;
  dataInicio: string;
  dataFim: string | null;
  origem: "LICITACAO" | "ATA";
  origemNumero: string | null;
  itensDisponiveis: number;
};

/** Detalhe do contrato: itens, unidades destinadas e de onde ele nasceu. */
export type ContractDetail = Contract & {
  processoId: string | null;
  fornecedorRazaoSocial: string;
  fornecedorDocumento: string;
  fiscalNomeMatricula: string | null;
  origem: "LICITACAO" | "ATA";
  origemId: string | null;
  origemNumero: string | null;
  origemObjeto: string | null;
  /** Ata nasce de licitação: o rastro vai até ela. */
  licitacaoDaAtaId: string | null;
  licitacaoDaAtaNumero: string | null;
  unidades: { id: string; nome: string }[];
  itens: ContractItem[];
  solicitacoes: number;
};
