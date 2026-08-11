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
  listarFila(orgaoId: string, setorId?: string): Promise<ProcessoDetalhe[]>;
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
