export const BID_MODALITIES = [
  "PREGAO_ELETRONICO",
  "PREGAO_PRESENCIAL",
  "CONCORRENCIA",
  "DISPENSA",
  "INEXIGIBILIDADE",
  "CHAMADA_PUBLICA",
  "LEILAO",
  "DIALOGO_COMPETITIVO",
] as const;

export type BidModality = (typeof BID_MODALITIES)[number];

export type Bid = {
  id: string;
  numero: string;
  resumo: string | null;
  objeto: string;
  modalidade: BidModality;
  dataAssinatura: string;
  valorTotal: number;
};

/** O que a licitação originou: contratos diretos e atas de registro. */
export type BidContract = {
  id: string;
  numero: string;
  fornecedorRazaoSocial: string;
  dataInicio: string;
  dataFim: string | null;
  valorTotal: number;
  /** Preenchido quando o contrato veio por uma ata desta licitação. */
  viaAta: string | null;
};

export type BidPriceRecord = {
  id: string;
  numero: string;
  dataVigencia: string;
  valorTotal: number;
  contratos: number;
};

export type BidDetail = Bid & {
  contratos: BidContract[];
  atas: BidPriceRecord[];
};
