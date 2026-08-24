import type { Pagina, Paginacao } from "../shared/Paginacao";
export type DadosFornecedor = {
  documento: string;
  razaoSocial: string;
  endereco?: string;
  email?: string;
  telefone?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
};

export type FornecedorCompleto = DadosFornecedor & { id: string };

// Cadastro GLOBAL: compartilhado entre todas as prefeituras.
// Toda alteração registra histórico com os dados anteriores.
export interface FornecedorRepository {
  buscarPorDocumento(documento: string): Promise<FornecedorCompleto | null>;
  buscarPorId(id: string): Promise<FornecedorCompleto | null>;
  criar(dados: DadosFornecedor): Promise<string>;
  atualizar(id: string, dados: Partial<DadosFornecedor>, alteradoPor: string): Promise<void>;
  listar(paginacao: Paginacao, busca?: string): Promise<Pagina<FornecedorCompleto>>;
}
