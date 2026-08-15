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

export type ItemDeInventario = ConferenciaDeItem & {
  id: string | null;
  codigoTombamento: string;
  nome: string;
  estadoRegistrado: string;
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
  criarRemessa(dados: NovaRemessa, tx: Tx): Promise<{ id: string; tombamentos: string[] }>;

  listarBens(orgaoId: string, filtros: { localId?: string; status?: string }): Promise<BemResumo[]>;

  listarInventarios(orgaoId: string): Promise<InventarioResumo[]>;
  buscarInventario(orgaoId: string, id: string): Promise<InventarioResumo | null>;
  inventarioAbertoNoLocal(orgaoId: string, localId: string): Promise<boolean>;
  abrirInventario(dados: NovoInventario): Promise<string>;
  itensDoInventario(orgaoId: string, inventarioId: string): Promise<ItemDeInventario[]>;
  registrarConferencia(inventarioId: string, item: ConferenciaDeItem): Promise<void>;
  concluirInventario(orgaoId: string, id: string): Promise<void>;
}
