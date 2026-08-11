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
