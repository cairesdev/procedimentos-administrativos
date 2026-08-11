export const MEASUREMENT_MODES = ["UNIDADE", "PERCENTUAL", "VALOR"] as const;

export type MeasurementMode = (typeof MEASUREMENT_MODES)[number];

export type Contract = {
  id: string;
  numero: string;
  fornecedorId: string;
  dataInicio: string;
  dataFim: string;
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

export type CreatedContract = {
  id: string;
  numeroProtocolo: string;
  numeroProcessoAdm: string;
};
