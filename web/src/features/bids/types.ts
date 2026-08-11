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
