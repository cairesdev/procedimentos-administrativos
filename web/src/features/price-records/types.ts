export type PriceRecord = {
  id: string;
  numero: string;
  objeto: string;
  licitacaoId: string | null;
  dataAssinatura: string;
  dataVigencia: string;
  valorTotal: number;
};

export type PriceRecordItem = {
  id: string;
  produto: string;
  descricao: string | null;
  unidadeMedida: string;
  marca: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

/** Contrato firmado a partir da ata. */
export type PriceRecordContract = {
  id: string;
  numero: string;
  fornecedorRazaoSocial: string;
  dataInicio: string;
  dataFim: string | null;
  valorTotal: number;
};

export type PriceRecordDetail = PriceRecord & {
  /** Número da licitação que originou a ata; nulo quando não há vínculo. */
  licitacaoNumero: string | null;
  itens: PriceRecordItem[];
  contratos: PriceRecordContract[];
};
