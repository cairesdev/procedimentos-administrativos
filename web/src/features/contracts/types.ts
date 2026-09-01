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
  /** Vem da ata ou da licitação: o contrato não tem objeto próprio. */
  objeto: string;
  fornecedorRazaoSocial: string;
  dataInicio: string;
  dataFim: string | null;
  valorTotal: number;
  origem: "LICITACAO" | "ATA";
  origemNumero: string | null;
  itensDisponiveis: number;
  /** Quanto ainda dá para pedir, em dinheiro. */
  saldoDisponivel: number;
};

/** Detalhe do contrato: itens, unidades destinadas e de onde ele nasceu. */
export type ContractDetail = Contract & {
  processoId: string | null;
  fornecedorRazaoSocial: string;
  fornecedorDocumento: string;
  fornecedorEndereco: string | null;
  fornecedorEmail: string | null;
  fornecedorTelefone: string | null;
  fornecedorInscricaoEstadual: string | null;
  fiscalNomeMatricula: string | null;
  /** Nulo quando a origem é ata: modalidade é da licitação. */
  origemModalidade: string | null;
  origemValor: number | null;
  origemData: string | null;
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
