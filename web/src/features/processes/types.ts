import type { Page } from "@/shared/api/pagination";
export type ProcessStatus = "ABERTO" | "TRAMITANDO" | "ENCERRADO" | "CANCELADO";

export type Process = {
  id: string;
  orgaoId: string;
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  tipoProcesso: string;
  setorAtualId: string | null;
  departamentoAtualId: string | null;
  status: ProcessStatus;
  /** Quando o processo chegou ao setor onde está. */
  entrouNoSetorEm: string;
  /** Prazo da etapa atual; nulo quando a etapa não tem prazo ativo. */
  prazoDias: number | null;
  prazoLimite: string | null;
  /** Negativo = atrasado. Nulo quando não há prazo. */
  diasParaVencer: number | null;
  /** Solicitação que abriu o processo; nulo quando não veio de pedido. */
  solicitacaoId?: string | null;
};

export type Dispatch = {
  id: string;
  tipo: "ANALISE" | "ENCAMINHAMENTO" | "PARECER" | "ORDEM_FORNECIMENTO" | "CANCELAMENTO";
  texto: string | null;
  data: string;
  setorId: string;
  departamentoId: string | null;
  usuarioNome: string;
};

export type ProcessDetail = Process & { despachos: Dispatch[]; limiarAlertaDias: number };

/**
 * Ordem emitida no processo. É dela que sai a peça — ordem de compras ou
 * ordem de serviço —, e por isso ela precisa ter rosto na tela: sem o número
 * à vista, o documento correspondente não tem como ser pedido.
 */
export type SupplyOrder = {
  id: string;
  numero: string;
  valor: string;
  data: string;
  contratoNumero: string;
  fornecedorNome: string;
  numeroEmpenho: string | null;
  numeroNotaFiscal: string | null;
};

/**
 * Fila paginada. Os contadores vêm da API porque falam da fila inteira, não
 * da página — e `limiarAlertaDias` vem junto para a linha ser pintada com o
 * mesmo critério que gerou o número.
 */
export type ProcessQueue = Page<Process> & {
  atrasados: number;
  vencendo: number;
  limiarAlertaDias: number;
};
