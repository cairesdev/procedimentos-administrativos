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

// resumo aceita null para limpar o campo — o repositório distingue
// "não informado" (mantém) de "null" (apaga).
export type EdicaoLicitacao = Partial<Omit<NovaLicitacao, "orgaoId" | "resumo">> & {
  resumo?: string | null;
};

export interface LicitacaoRepository {
  existeNumero(orgaoId: string, numero: string, ignorarId?: string): Promise<boolean>;
  criar(dados: NovaLicitacao): Promise<string>;
  listar(orgaoId: string): Promise<LicitacaoResumo[]>;
  buscarPorId(orgaoId: string, id: string): Promise<LicitacaoResumo | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoLicitacao): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string): Promise<void>;
}
