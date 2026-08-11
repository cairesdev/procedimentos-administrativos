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

export interface LicitacaoRepository {
  existeNumero(orgaoId: string, numero: string): Promise<boolean>;
  criar(dados: NovaLicitacao): Promise<string>;
  listar(orgaoId: string): Promise<LicitacaoResumo[]>;
  buscarPorId(orgaoId: string, id: string): Promise<LicitacaoResumo | null>;
}
