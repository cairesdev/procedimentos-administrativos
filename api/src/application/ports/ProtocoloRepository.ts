import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

export type AssuntoDeProtocolo = {
  id: string;
  nome: string;
  descricao: string | null;
  /** Setor que resolve; nulo cai na primeira etapa do fluxo. */
  setorId: string | null;
  setorNome: string | null;
  prazoDias: number | null;
  ativo: boolean;
  /** Quantos atendimentos já entraram por este assunto. */
  atendimentos: number;
};

export type NovoAssunto = {
  orgaoId: string;
  nome: string;
  descricao?: string;
  setorId?: string;
  prazoDias?: number;
  ativo: boolean;
};

export type TipoDeRequerente = "FORNECEDOR" | "CIDADAO" | "OUTRO_ORGAO" | "SERVIDOR";

export type Requerente = {
  id: string;
  tipo: TipoDeRequerente;
  documento: string;
  nome: string;
  contatoEmail: string | null;
  contatoTelefone: string | null;
};

export type NovoRequerente = {
  orgaoId: string;
  tipo: TipoDeRequerente;
  documento: string;
  nome: string;
  contatoEmail?: string;
  contatoTelefone?: string;
  fornecedorId?: string;
};

/** Linha da fila de atendimentos, para o balcão acompanhar. */
export type AtendimentoResumo = {
  id: string;
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  status: string;
  dataAbertura: string;
  origemAtendimento: string | null;
  assuntoNome: string | null;
  setorAtualNome: string | null;
  requerenteNome: string;
  requerenteDocumento: string;
};

/**
 * O que a consulta pública devolve. É deliberadamente menos que o processo:
 * despacho interno, parecer e anexo de servidor não são resposta ao cidadão.
 */
export type AcompanhamentoPublico = {
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  status: string;
  dataAbertura: string;
  dataEncerramento: string | null;
  assuntoNome: string | null;
  descricaoPedido: string | null;
  setorAtualNome: string | null;
  prazoDias: number | null;
  requerenteNome: string;
  orgaoNome: string;
  /** Andamento resumido: só a movimentação entre setores, sem texto interno. */
  andamento: { data: string; setorNome: string | null }[];
};

export type NovoAtendimento = {
  orgaoId: string;
  requerenteId: string;
  assuntoId: string;
  descricaoPedido: string;
  origem: "BALCAO" | "PORTAL";
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  setorAtualId?: string;
  departamentoAtualId?: string;
};

export type Exigencia = {
  id: string;
  processoId: string;
  texto: string;
  prazoDias: number | null;
  prazoLimite: string | null;
  status: "PENDENTE" | "RESPONDIDA" | "CANCELADA";
  criadaEm: string;
  criadaPorNome: string;
  respostaTexto: string | null;
  respondidaEm: string | null;
  canceladaMotivo: string | null;
  /** Quantos documentos o requerente juntou respondendo a esta exigência. */
  anexos: number;
};

export type NovaExigencia = {
  orgaoId: string;
  processoId: string;
  texto: string;
  prazoDias?: number;
  criadaPorUsuarioId: string;
};

/**
 * Processo alcançado pelo par protocolo + documento — a credencial do canal
 * público. Devolve o mínimo para autorizar a ação do requerente.
 */
export type ProcessoDoRequerente = {
  processoId: string;
  orgaoId: string;
  requerenteId: string;
  status: string;
};

/** Identificação mínima da prefeitura para o portal do cidadão. */
export type PrefeituraPublica = {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
};

export interface ProtocoloRepository {
  /**
   * Prefeitura pelo CNPJ, para o portal público. A busca é por CNPJ e não por
   * id porque o endereço do portal é divulgado pela prefeitura e o CNPJ é
   * público por natureza — e porque não existe listagem: expor todas as
   * prefeituras atendidas entregaria a carteira de clientes do produto.
   */
  buscarPrefeituraPorCnpj(cnpj: string): Promise<PrefeituraPublica | null>;
  /** Quantos pedidos este documento abriu na janela — freio de abuso. */
  contarAberturasRecentes(documento: string, desde: Date): Promise<number>;
  listarAssuntos(orgaoId: string, apenasAtivos?: boolean): Promise<AssuntoDeProtocolo[]>;
  buscarAssunto(orgaoId: string, id: string): Promise<AssuntoDeProtocolo | null>;
  criarAssunto(dados: NovoAssunto): Promise<string>;
  atualizarAssunto(orgaoId: string, id: string, dados: Omit<NovoAssunto, "orgaoId">): Promise<void>;
  removerAssunto(orgaoId: string, id: string): Promise<void>;

  buscarRequerentePorDocumento(orgaoId: string, documento: string): Promise<Requerente | null>;
  criarRequerente(dados: NovoRequerente, tx: Tx): Promise<string>;
  atualizarContato(
    id: string,
    dados: { nome: string; contatoEmail?: string; contatoTelefone?: string },
    tx: Tx,
  ): Promise<void>;

  criarAtendimento(dados: NovoAtendimento, tx: Tx): Promise<string>;
  listarAtendimentos(
    orgaoId: string,
    filtros: { status?: string; assuntoId?: string; busca?: string },
    paginacao: Paginacao,
  ): Promise<Pagina<AtendimentoResumo>>;

  /**
   * Consulta pública. Casa protocolo **e** documento: o número sozinho é
   * sequencial e adivinhável, e sem o documento qualquer um leria o pedido
   * alheio.
   */
  acompanhar(numeroProtocolo: string, documento: string): Promise<AcompanhamentoPublico | null>;

  /** Autoriza a ação do requerente: o par protocolo + documento tem de casar. */
  processoDoRequerente(
    numeroProtocolo: string,
    documento: string,
  ): Promise<ProcessoDoRequerente | null>;

  listarExigencias(orgaoId: string, processoId: string): Promise<Exigencia[]>;
  buscarExigencia(id: string): Promise<Exigencia | null>;
  criarExigencia(dados: NovaExigencia, prazoLimite: string | null): Promise<string>;
  responderExigencia(id: string, texto: string): Promise<void>;
  cancelarExigencia(orgaoId: string, id: string, motivo: string): Promise<void>;
  /** Exigências que o requerente vê no acompanhamento — sem dado interno. */
  exigenciasDoRequerente(processoId: string): Promise<Exigencia[]>;
}
