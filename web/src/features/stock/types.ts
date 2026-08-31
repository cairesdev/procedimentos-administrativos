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
  ativo: boolean;
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

export const CONSUMPTION_FORMS = [
  { value: "ITEM_A_ITEM", label: "Item a item" },
  { value: "DECLARACAO_PERIODICA", label: "Declaração do período" },
] as const;

export type ConsumptionForm = (typeof CONSUMPTION_FORMS)[number]["value"];

export type Consumption = {
  id: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidade: number;
  forma: ConsumptionForm;
  periodoInicio: string | null;
  periodoFim: string | null;
  data: string;
  usuarioNome: string;
  observacao: string | null;
  lotes: number;
};

export const RETURN_STATUSES = [
  { value: "PENDENTE", label: "aguardando aceite", tone: "accent" },
  { value: "ACEITA", label: "aceita", tone: "success" },
  { value: "RECUSADA", label: "recusada", tone: "neutral" },
] as const;

export type StockReturn = {
  id: string;
  localNome: string;
  almoxarifadoNome: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidade: number;
  status: "PENDENTE" | "ACEITA" | "RECUSADA";
  motivo: string | null;
  recusaMotivo: string | null;
  solicitadaPor: string;
  aceitaPor: string | null;
  dataValidade: string | null;
  data: string;
  respondidaEm: string | null;
};

export type StockTransfer = {
  id: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidade: number;
  origemNome: string;
  destinoNome: string;
  usuarioNome: string;
  motivo: string | null;
  dataValidade: string | null;
  data: string;
};

/**
 * Motivos de ajuste. `SOBRA` e `CONTAGEM` existem porque contagem física acha
 * material a mais também — caixa atrás da porta, entrada lançada a menor.
 */
export const ADJUSTMENT_REASONS = [
  { value: "CONTAGEM", label: "Contagem física" },
  { value: "PERDA", label: "Perda" },
  { value: "AVARIA", label: "Avaria" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "SOBRA", label: "Sobra encontrada" },
  { value: "ERRO_LANCAMENTO", label: "Erro de lançamento" },
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]["value"];

export type Adjustment = {
  id: string;
  onde: string;
  produtoNome: string;
  unidadeMedida: string;
  saldoAnterior: number;
  saldoCorrigido: number;
  diferenca: number;
  motivo: AdjustmentReason;
  observacao: string | null;
  usuarioNome: string;
  data: string;
};

/**
 * Relatório de consumo (PNAE). Guarda o recorte; os números são apurados na
 * leitura, e a peça emitida sobre ele congela o resultado.
 */
export type ConsumptionReport = {
  id: string;
  almoxarifadoId: string;
  almoxarifadoNome: string;
  tipoEstoqueId: string | null;
  tipoEstoqueNome: string | null;
  periodoInicio: string;
  periodoFim: string;
  criadoPorNome: string | null;
  criadoEm: string;
};

export type ReportUnitRow = {
  localId: string;
  nome: string;
  cnpj: string | null;
  /** O que a unidade confirmou receber, não o que foi despachado. */
  recebido: number;
  consumido: number;
  perdido: number;
  devolvido: number;
  /** Saldo de hoje no armário, não o do fim do período. */
  saldo: number;
};

export type ReportProductRow = {
  produtoId: string;
  nome: string;
  unidadeMedida: string;
  recebido: number;
  consumido: number;
  perdido: number;
  devolvido: number;
};

export type ConsumptionReportDetail = ConsumptionReport & {
  unidades: ReportUnitRow[];
  produtos: ReportProductRow[];
  entradasTotal: number;
  entradasAgriculturaFamiliar: number;
};

/**
 * Acompanhamento do material armazenado — dano, validade, armazenagem.
 * Não movimenta saldo: quem tira material do estoque é o ajuste.
 */
export const QUALITY_TYPES = [
  { value: "DANO", label: "Dano ou avaria", tone: "warning" },
  { value: "VALIDADE", label: "Validade", tone: "warning" },
  { value: "ARMAZENAMENTO", label: "Armazenamento", tone: "accent" },
  { value: "CONFORMIDADE", label: "Conformidade", tone: "neutral" },
  { value: "OUTRO", label: "Outro", tone: "neutral" },
] as const;

export type QualityRecord = {
  id: string;
  loteId: string | null;
  estoqueLocalId: string | null;
  produtoNome: string;
  unidadeMedida: string;
  /** Onde o material está: o almoxarifado ou a unidade que o recebeu. */
  ondeEsta: string;
  tipo: string;
  observacao: string;
  /** Nula quando a observação não tem quantidade — e isso é comum. */
  quantidade: number | null;
  usuarioNome: string;
  data: string;
};
