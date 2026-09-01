/**
 * As modalidades, espelhando `api/src/domain/licitacao/Modalidades.ts`.
 *
 * Espelho, e não importação: o web não alcança o código da API. A sigla de duas
 * letras é a do layout do Tribunal, e aparece no seletor porque é por ela que o
 * pessoal de compras se refere à modalidade — "manda como DE" é frase de
 * corredor. Um teste estrutural na API compara as duas listas e falha se
 * divergirem.
 */
export const BID_MODALITIES = [
  { id: "DISPENSA", sigla: "DP", nome: "Dispensa de licitação" },
  { id: "DISPENSA_ELETRONICA", sigla: "DE", nome: "Dispensa eletrônica de licitação" },
  { id: "INEXIGIBILIDADE", sigla: "IN", nome: "Inexigibilidade de licitação" },
  { id: "CREDENCIAMENTO", sigla: "CR", nome: "Credenciamento" },
  { id: "ADESAO_ATA", sigla: "AA", nome: "Adesão à ata de registro de preços" },
  { id: "CONCORRENCIA", sigla: "CP", nome: "Concorrência pública" },
  { id: "TOMADA_DE_PRECOS", sigla: "TP", nome: "Tomada de preços" },
  { id: "CARTA_CONVITE", sigla: "CC", nome: "Carta convite" },
  { id: "CONCURSO", sigla: "CO", nome: "Concurso" },
  { id: "LEILAO", sigla: "LL", nome: "Leilão" },
  { id: "LICITACAO_INTERNACIONAL", sigla: "LI", nome: "Licitação internacional" },
  { id: "PREGAO_ELETRONICO", sigla: "PE", nome: "Pregão eletrônico" },
  { id: "PREGAO_PRESENCIAL", sigla: "PP", nome: "Pregão presencial" },
  { id: "RDC_ELETRONICO", sigla: "RE", nome: "RDC eletrônico" },
  { id: "RDC_PRESENCIAL", sigla: "RP", nome: "RDC presencial" },
  { id: "DIALOGO_COMPETITIVO", sigla: "DC", nome: "Diálogo competitivo" },
  { id: "LEI_13303", sigla: "PL", nome: "Procedimentos da Lei nº 13.303/2016" },
  { id: "OUTROS", sigla: "OT", nome: "Outros procedimentos de licitação" },
  // Sem sigla no layout do Tribunal; é a modalidade do PNAE, e há licitação
  // gravada com ela desde antes desta lista existir.
  { id: "CHAMADA_PUBLICA", sigla: null, nome: "Chamada pública" },
] as const;

export type BidModality = (typeof BID_MODALITIES)[number]["id"];

export const BID_MODALITY_IDS = BID_MODALITIES.map((m) => m.id) as unknown as
  [BidModality, ...BidModality[]];

/** "PE · Pregão eletrônico" — a sigla primeiro, que é como se procura. */
export const bidModalityLabel = (id: string): string => {
  const modalidade = BID_MODALITIES.find((item) => item.id === id);
  if (!modalidade) return id;
  return modalidade.sigla ? `${modalidade.sigla} · ${modalidade.nome}` : modalidade.nome;
};

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
