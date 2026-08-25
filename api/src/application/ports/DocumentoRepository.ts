import type { Pagina, Paginacao } from "../shared/Paginacao";

export type ModeloDeDocumento = {
  id: string;
  /** Nulo = modelo global do produto; preenchido = versão da prefeitura. */
  orgaoId: string | null;
  modulo: string;
  tipo: string;
  /** De onde a peça fala: decide marcadores e busca de dados. */
  escopo: string;
  nome: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
  /** Criado pela prefeitura, sem padrão do produto por trás. */
  personalizado: boolean;
  atualizadoEm: string;
};

/** Modelo em uso para um tipo, com a origem explícita para a tela mostrar. */
export type ModeloResolvido = ModeloDeDocumento & {
  origem: "GLOBAL" | "PREFEITURA";
};

export type NovoModelo = {
  orgaoId: string | null;
  modulo: string;
  tipo: string;
  escopo: string;
  nome: string;
  titulo: string;
  corpo: string;
  ativo: boolean;
  personalizado: boolean;
};

export type DocumentoEmitido = {
  id: string;
  orgaoId: string;
  modulo: string;
  tipo: string;
  codigo: string;
  titulo: string;
  corpo: string;
  referenciaId: string;
  emitidoPorNome: string;
  emitidoPorCargo: string;
  data: string;
  canceladoEm: string | null;
  canceladoMotivo: string | null;
};

/** O que a página pública de conferência mostra — nunca dados internos. */
export type DocumentoParaConferencia = {
  codigo: string;
  titulo: string;
  corpo: string;
  data: string;
  emitidoPorNome: string;
  emitidoPorCargo: string;
  orgaoNome: string;
  canceladoEm: string | null;
  canceladoMotivo: string | null;
};

export type NovoDocumentoEmitido = {
  orgaoId: string;
  modulo: string;
  tipo: string;
  codigo: string;
  titulo: string;
  corpo: string;
  dados: Record<string, unknown>;
  referenciaId: string;
  modeloId: string;
  emitidoPorUsuarioId: string;
  emitidoPorNome: string;
  emitidoPorCargo: string;
};

export interface DocumentoRepository {
  /**
   * Modelo em vigor para o tipo: o da prefeitura quando existe, senão o
   * global. É a regra que faz "restaurar padrão" ser só apagar a linha.
   */
  resolverModelo(orgaoId: string, tipo: string): Promise<ModeloResolvido | null>;
  /** Todos os tipos disponíveis para o órgão, já resolvidos. */
  listarModelosResolvidos(orgaoId: string, modulo?: string): Promise<ModeloResolvido[]>;
  /** Um tipo já existe para este órgão (global ou próprio)? */
  tipoEmUso(orgaoId: string | null, tipo: string): Promise<boolean>;
  listarModelosGlobais(): Promise<ModeloDeDocumento[]>;
  buscarModelo(id: string): Promise<ModeloDeDocumento | null>;
  criarModelo(dados: NovoModelo): Promise<string>;
  atualizarModelo(
    id: string,
    dados: Pick<NovoModelo, "nome" | "titulo" | "corpo" | "ativo">,
  ): Promise<void>;
  /** Apagar a linha da prefeitura devolve o tipo ao modelo global. */
  removerModelo(id: string): Promise<void>;

  emitir(dados: NovoDocumentoEmitido): Promise<string>;
  buscarEmitido(orgaoId: string, id: string): Promise<DocumentoEmitido | null>;
  listarPorReferencia(orgaoId: string, referenciaId: string): Promise<DocumentoEmitido[]>;
  listarEmitidos(orgaoId: string, paginacao: Paginacao): Promise<Pagina<DocumentoEmitido>>;
  /** Busca sem órgão: a conferência é pública e o código é único no produto. */
  buscarPorCodigo(codigo: string): Promise<DocumentoParaConferencia | null>;
  cancelar(orgaoId: string, id: string, motivo: string): Promise<void>;
}
