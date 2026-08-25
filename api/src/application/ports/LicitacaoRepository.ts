import type { Pagina, Paginacao } from "../shared/Paginacao";
export type NovaLicitacao = {
  orgaoId: string;
  numero: string;
  resumo?: string;
  objeto: string;
  modalidade: string;
  dataAssinatura: string;
  valorTotal: number;
  unidadesDestinadas: string[];
};

export type LicitacaoResumo = {
  id: string;
  numero: string;
  resumo: string | null;
  objeto: string;
  modalidade: string;
  dataAssinatura: string;
  valorTotal: number;
};

/** O que a licitação gerou: contratos diretos e atas de registro de preços. */
export type ContratoDaLicitacao = {
  id: string;
  numero: string;
  fornecedorRazaoSocial: string;
  dataInicio: string;
  dataFim: string | null;
  valorTotal: number;
  /** Direto da licitação ou por meio de uma ata dela. */
  viaAta: string | null;
};

export type AtaDaLicitacao = {
  id: string;
  numero: string;
  dataVigencia: string;
  valorTotal: number;
  contratos: number;
};

export type LicitacaoCompleta = LicitacaoResumo & {
  contratos: ContratoDaLicitacao[];
  atas: AtaDaLicitacao[];
};

// resumo aceita null para limpar o campo — o repositório distingue
// "não informado" (mantém) de "null" (apaga).
export type EdicaoLicitacao = Partial<Omit<NovaLicitacao, "orgaoId" | "resumo">> & {
  resumo?: string | null;
};

export interface LicitacaoRepository {
  existeNumero(orgaoId: string, numero: string, ignorarId?: string): Promise<boolean>;
  criar(dados: NovaLicitacao): Promise<string>;
  listar(orgaoId: string, paginacao: Paginacao): Promise<Pagina<LicitacaoResumo>>;
  buscarPorId(orgaoId: string, id: string): Promise<LicitacaoResumo | null>;
  /** Detalhe com o que a licitação originou — contratos e atas. */
  buscarCompleta(orgaoId: string, id: string): Promise<LicitacaoCompleta | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoLicitacao): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string): Promise<void>;
}
