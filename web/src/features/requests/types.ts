export type RequestItem = {
  itemId: string;
  quantidadeSolicitada: number;
  valorCalculado: number;
};

export type RequestStatus = "RASCUNHO" | "ENVIADA";

/** Linha da listagem de solicitações. */
export type RequestSummary = {
  id: string;
  situacao: RequestStatus;
  unidadeSolicitanteId: string;
  unidadeSolicitanteNome: string;
  processoId: string | null;
  numeroProtocolo: string | null;
  numeroProcessoAdm: string | null;
  statusProcesso: string | null;
  criadaEm: string;
  totalItens: number;
  valorTotal: number;
};

/** Item com tudo que veio do contrato de origem, mais o saldo de hoje. */
export type RequestItemDetail = {
  itemId: string;
  contratoId: string;
  produto: string;
  descricao: string | null;
  unidadeMedida: string;
  marca: string | null;
  modoMedicao: "UNIDADE" | "PERCENTUAL" | "VALOR";
  valorUnitario: number;
  quantidadeSolicitada: number;
  valorCalculado: number;
  quantidadeTotalContratada: number;
  saldoDisponivel: number;
};

export type RequestContract = {
  id: string;
  numero: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
  fiscalNomeMatricula: string | null;
  fornecedorId: string;
  fornecedorRazaoSocial: string;
  fornecedorDocumento: string;
  fornecedorEmail: string | null;
  fornecedorTelefone: string | null;
  origem: "LICITACAO" | "ATA";
  origemNumero: string | null;
};

export type RequestDetail = RequestSummary & {
  itens: RequestItemDetail[];
  contratos: RequestContract[];
};

export const MEASUREMENT_LABELS: Record<RequestItemDetail["modoMedicao"], string> = {
  UNIDADE: "por unidade",
  PERCENTUAL: "por percentual",
  VALOR: "por valor",
};

export type CreatedRequest = { id: string };

export type SentRequest = {
  processoId: string;
  protocolo: string;
  processoAdm: string;
};
