import type { Tx } from "./Transacao";

export type NovoLocal = {
  orgaoId: string;
  unidadeId?: string;
  codigo: string;
  nome: string;
};

export type LocalResumo = {
  id: string;
  codigo: string;
  nome: string;
  unidadeId: string | null;
  ativo: boolean;
  bens: number;
};

export type EdicaoLocal = { nome?: string; unidadeId?: string | null; ativo?: boolean };

export type NovaCategoria = { orgaoId: string; nome: string };
export type CategoriaResumo = { id: string; nome: string; ativo: boolean; bens: number };
export type EdicaoCategoria = { nome?: string; ativo?: boolean };

export type LoteDaRemessa = {
  categoriaId: string;
  localDestinoId: string;
  nomeBem: string;
  quantidade: number;
};

export type NovaRemessa = {
  orgaoId: string;
  data: string;
  fornecedorId?: string;
  notaFiscal?: string;
  contratoId?: string;
  lotes: LoteDaRemessa[];
};

export type RemessaResumo = {
  id: string;
  data: string;
  notaFiscal: string | null;
  fornecedorId: string | null;
  bens: number;
};

/** `conferencias` trava a exclusão: bem já conferido em inventário não some. */
export type RemessaDetalhe = RemessaResumo & { conferencias: number };

export type EdicaoRemessa = {
  data?: string;
  fornecedorId?: string | null;
  notaFiscal?: string | null;
};

export type BemResumo = {
  id: string;
  codigoTombamento: string;
  nome: string;
  categoriaId: string;
  categoriaNome: string;
  localAtualId: string;
  localAtualNome: string;
  estadoConservacao: string;
  status: string;
};

export type BemDetalhe = BemResumo & { conferencias: number };

export type EdicaoBem = { nome?: string; categoriaId?: string };

export type NovoInventario = { localId: string; dataInicio: string };

export type InventarioResumo = {
  id: string;
  localId: string;
  localNome: string;
  dataInicio: string;
  dataConclusao: string | null;
  status: "ABERTO" | "CONCLUIDO";
  conferidos: number;
  esperados: number;
  divergencias: number;
};

export type ConferenciaDeItem = {
  bemId: string;
  situacao: "ENCONTRADO" | "NAO_ENCONTRADO";
  estadoObservado?: string;
  observacao?: string;
};

// situacao nula = bem ainda não conferido nesta rodada.
export type ItemDeInventario = {
  id: string | null;
  bemId: string;
  codigoTombamento: string;
  nome: string;
  estadoRegistrado: string;
  situacao: "ENCONTRADO" | "NAO_ENCONTRADO" | null;
  estadoObservado: string | null;
  observacao: string | null;
};

export interface PatrimonioRepository {
  listarLocais(orgaoId: string): Promise<LocalResumo[]>;
  buscarLocal(orgaoId: string, id: string): Promise<LocalResumo | null>;
  existeCodigoLocal(orgaoId: string, codigo: string, ignorarId?: string): Promise<boolean>;
  criarLocal(dados: NovoLocal): Promise<string>;
  atualizarLocal(orgaoId: string, id: string, dados: EdicaoLocal): Promise<void>;
  removerLocal(orgaoId: string, id: string): Promise<void>;

  listarCategorias(orgaoId: string): Promise<CategoriaResumo[]>;
  buscarCategoria(orgaoId: string, id: string): Promise<CategoriaResumo | null>;
  criarCategoria(dados: NovaCategoria): Promise<string>;
  atualizarCategoria(orgaoId: string, id: string, dados: EdicaoCategoria): Promise<void>;
  removerCategoria(orgaoId: string, id: string): Promise<void>;

  listarRemessas(orgaoId: string): Promise<RemessaResumo[]>;
  buscarRemessa(orgaoId: string, id: string): Promise<RemessaDetalhe | null>;
  criarRemessa(dados: NovaRemessa, tx: Tx): Promise<{ id: string; tombamentos: string[] }>;
  atualizarRemessa(orgaoId: string, id: string, dados: EdicaoRemessa): Promise<void>;
  removerRemessa(orgaoId: string, id: string, tx: Tx): Promise<void>;

  listarBens(orgaoId: string, filtros: { localId?: string; status?: string }): Promise<BemResumo[]>;
  buscarBem(orgaoId: string, id: string): Promise<BemDetalhe | null>;
  atualizarBem(orgaoId: string, id: string, dados: EdicaoBem): Promise<void>;
  removerBem(orgaoId: string, id: string): Promise<void>;

  listarInventarios(orgaoId: string): Promise<InventarioResumo[]>;
  buscarInventario(orgaoId: string, id: string): Promise<InventarioResumo | null>;
  inventarioAbertoNoLocal(orgaoId: string, localId: string): Promise<boolean>;
  abrirInventario(dados: NovoInventario): Promise<string>;
  itensDoInventario(orgaoId: string, inventarioId: string): Promise<ItemDeInventario[]>;
  registrarConferencia(inventarioId: string, item: ConferenciaDeItem): Promise<void>;
  concluirInventario(orgaoId: string, id: string): Promise<void>;
}
