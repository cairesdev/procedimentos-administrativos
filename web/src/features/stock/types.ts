/** Espelho do que a API do almoxarifado devolve. */

export type Warehouse = {
  id: string;
  nome: string;
  ativo: boolean;
  locais: number;
  remessas: number;
};

export type StockType = {
  id: string;
  nome: string;
  ativo: boolean;
  remessas: number;
};

/** Catálogo global entre prefeituras — sem órgão. */
export type Product = {
  id: string;
  nome: string;
  unidadeMedida: string;
  ativo: boolean;
};

export type StockLocation = {
  id: string;
  nome: string;
  codigo: string;
  unidadeId: string | null;
  almoxarifadoId: string | null;
  almoxarifadoNome: string | null;
  cnpj: string | null;
  endereco: string | null;
  responsavel: string | null;
};

export type StockSettings = {
  reservaAtiva: boolean;
  reservaPrazoHoras: number;
  alertaValidadeDias: number;
};

export type Intake = {
  id: string;
  codigo: string;
  titulo: string;
  data: string;
  almoxarifadoNome: string;
  tipoEstoqueNome: string;
  localArmazenado: string | null;
  notaFiscal: string | null;
  fornecedorRazaoSocial: string | null;
  responsavelNome: string;
  lotes: number;
};

export type Batch = {
  id: string;
  produtoId: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidade: number;
  saldo: number;
  dataValidade: string | null;
};

export type IntakeDetail = Intake & { lotes: Batch[] };

/** O que a unidade pode pedir: saldo menos as reservas do mesmo almoxarifado. */
export type Availability = {
  produtoId: string;
  nome: string;
  unidadeMedida: string;
  saldoTotal: number;
  reservado: number;
  disponivel: number;
  proximaValidade: string | null;
};

export const REQUEST_STATUSES = [
  { value: "RASCUNHO", label: "rascunho", tone: "warning" },
  { value: "SOLICITADA", label: "aguardando liberação", tone: "accent" },
  { value: "LIBERADA", label: "liberada", tone: "accent" },
  { value: "EM_TRANSITO", label: "em trânsito", tone: "accent" },
  { value: "RECEBIDA", label: "recebida", tone: "success" },
  { value: "RECUSADA", label: "recusada", tone: "neutral" },
  { value: "CANCELADA", label: "cancelada", tone: "neutral" },
  { value: "EXPIRADA", label: "reserva expirada", tone: "neutral" },
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number]["value"];

export const statusOf = (status: string) =>
  REQUEST_STATUSES.find((item) => item.value === status)
  ?? { value: status, label: status.toLowerCase(), tone: "neutral" as const };

export type StockRequestItem = {
  id: string;
  produtoId: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidadeSolicitada: number;
  quantidadeReservada: number;
  saldoDaUnidadeNoMomento: number | null;
  quantidadeLiberada: number | null;
  quantidadeRecebida: number | null;
};

export type StockRequest = {
  id: string;
  localSolicitanteId: string;
  localSolicitanteNome: string;
  almoxarifadoId: string | null;
  autorNome: string;
  tipoEstoqueId: string | null;
  tipoEstoqueNome: string | null;
  status: RequestStatus;
  data: string;
  enviadaEm: string | null;
  reservaExpiraEm: string | null;
  liberadaEm: string | null;
  recebidaEm: string | null;
  motivoRecusa: string | null;
  itens: StockRequestItem[];
};

export type StockRequestSummary = Omit<StockRequest, "itens"> & { totalItens: number };

/** Alerta de validade — nunca bloqueio. */
export type ExpiryState = "SEM_VALIDADE" | "VENCIDO" | "PROXIMO" | "OK";

export const EXPIRY_TONE: Record<ExpiryState, "neutral" | "success" | "warning"> = {
  SEM_VALIDADE: "neutral",
  VENCIDO: "warning",
  PROXIMO: "warning",
  OK: "success",
};

export const EXPIRY_LABEL: Record<ExpiryState, string> = {
  SEM_VALIDADE: "sem validade",
  VENCIDO: "vencido",
  PROXIMO: "vence em breve",
  OK: "no prazo",
};

export type BatchOption = {
  id: string;
  saldo: number;
  dataValidade: string | null;
  remessaCodigo: string;
  almoxarifadoNome: string;
  validade: ExpiryState;
  /** Distribuição FEFO calculada pela API; a tela usa como valor inicial. */
  sugerido: number;
};

export type ReleaseItem = StockRequestItem & {
  faltando: number;
  lotes: BatchOption[];
};

export type ReleasePlan = {
  solicitacao: StockRequest;
  itens: ReleaseItem[];
};

export type ReleasedLine = {
  id: string;
  solicitacaoItemId: string;
  loteId: string;
  produtoId: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidade: number;
  quantidadeConfirmada: number | null;
  dataValidade: string | null;
  remessaCodigo: string;
};

export type ReceiptPlan = {
  solicitacao: StockRequest;
  liberacoes: ReleasedLine[];
};

export const LOSS_REASONS = [
  { value: "QUEBRA_TRANSPORTE", label: "Quebra no transporte" },
  { value: "AVARIA", label: "Avaria" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "EXTRAVIO", label: "Extravio" },
  { value: "OUTRO", label: "Outro" },
] as const;

export type LossReason = (typeof LOSS_REASONS)[number]["value"];

/** Saldo da unidade, agrupado por produto e detalhado por lote. */
export type LocalStock = {
  produtoId: string;
  produtoNome: string;
  unidadeMedida: string;
  saldo: number;
  lotes: { id: string; saldo: number; dataValidade: string | null; dataEntrada: string }[];
};
