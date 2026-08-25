import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

export type ProcessoDetalhe = {
  id: string;
  orgaoId: string;
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  tipoProcesso: string;
  setorAtualId: string | null;
  departamentoAtualId: string | null;
  status: "ABERTO" | "TRAMITANDO" | "ENCERRADO" | "CANCELADO";
  /** Quando o processo chegou ao setor onde está: último encaminhamento, ou a abertura. */
  entrouNoSetorEm: string;
  /** Prazo da etapa atual no fluxo. Nulo quando a etapa não tem prazo ativo. */
  prazoDias: number | null;
  prazoLimite: string | null;
  /** Negativo = atrasado. Nulo quando não há prazo. */
  diasParaVencer: number | null;
  /** Solicitação que abriu o processo; nulo em processo aberto sem pedido. */
  solicitacaoId?: string | null;
};

/**
 * Fila paginada com os contadores da fila inteira. Somar só a página daria um
 * número menor que a realidade justamente na tela que existe para alertar.
 */
export type FilaDeProcessos = Pagina<ProcessoDetalhe> & {
  atrasados: number;
  vencendo: number;
  /** Mesmo limiar usado nos contadores, para o front pintar igual. */
  limiarAlertaDias: number;
};

export type NovoDespacho = {
  processoId: string;
  setorId: string;
  departamentoId?: string;
  usuarioId: string;
  lotacaoId: string;
  tipo: "ANALISE" | "ENCAMINHAMENTO" | "PARECER" | "ORDEM_FORNECIMENTO" | "CANCELAMENTO";
  texto?: string;
};

export type DestinoEtapa = { setorId: string; departamentoId: string | null };

export type NovaOrdemFornecimento = {
  orgaoId: string;
  processoId: string;
  contratoId: string;
  fornecedorId: string;
  numero: string;
  dadosContratante?: Record<string, unknown>;
  numeroEmpenho?: string;
  numeroRequisicao?: string;
  projetoAtividade?: string;
  elementoDespesa?: string;
  fonteRecurso?: string;
  valor: number;
  numeroParcelas?: number;
  numeroNotaFiscal?: string;
};

export interface TramitacaoRepository {
  buscarProcesso(orgaoId: string, processoId: string): Promise<ProcessoDetalhe | null>;
  listarFila(orgaoId: string, paginacao: Paginacao, setorId?: string): Promise<FilaDeProcessos>;
  listarDespachos(processoId: string): Promise<unknown[]>;
  registrarDespacho(dados: NovoDespacho, tx: Tx): Promise<string>;
  moverProcesso(processoId: string, destino: DestinoEtapa, tx: Tx): Promise<void>;
  encerrarProcesso(processoId: string, tx: Tx): Promise<void>;
  lotacaoPertenceAoUsuario(lotacaoId: string, usuarioId: string): Promise<boolean>;
  proximaEtapaApos(orgaoId: string, tipoProcesso: string, setorAtualId: string): Promise<DestinoEtapa | null>;
  registrarParecer(processoId: string, favoravel: boolean, justificativa: string | undefined, usuarioId: string, tx: Tx): Promise<string>;
  fornecedorDoContrato(orgaoId: string, contratoId: string): Promise<string | null>;
  contratoParticipaDoProcesso(processoId: string, contratoId: string): Promise<boolean>;
  existeNotaFiscal(orgaoId: string, fornecedorId: string, numeroNotaFiscal: string): Promise<boolean>;
  criarOrdem(dados: NovaOrdemFornecimento, tx: Tx): Promise<string>;
}
