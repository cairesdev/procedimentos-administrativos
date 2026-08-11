export type NovaUnidade = { orgaoId: string; nome: string; sigla?: string };
export type UnidadeResumo = { id: string; nome: string; sigla: string | null; ativo: boolean };

export type EdicaoUnidade = { nome?: string; sigla?: string | null; ativo?: boolean };

export interface UnidadeRepository {
  criar(dados: NovaUnidade): Promise<string>;
  listar(orgaoId: string): Promise<UnidadeResumo[]>;
  buscar(orgaoId: string, id: string): Promise<UnidadeResumo | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoUnidade): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string): Promise<void>;
}

export type TipoSetor =
  | "PROTOCOLO" | "COMPRAS" | "CONTROLADORIA"
  | "ALIMENTACAO_ESCOLAR" | "FROTAS" | "PATRIMONIO" | "OPERACIONAL";

export type NovoSetor = { orgaoId: string; nome: string; tipo: TipoSetor };
export type SetorResumo = { id: string; nome: string; tipo: TipoSetor; ativo: boolean };
export type EdicaoSetor = { nome?: string; tipo?: TipoSetor; ativo?: boolean };

export type NovoDepartamento = { setorId: string; nome: string; categoriaAtendimento?: string };
export type DepartamentoResumo = {
  id: string;
  nome: string;
  categoriaAtendimento: string | null;
  ativo: boolean;
};
export type EdicaoDepartamento = {
  nome?: string;
  categoriaAtendimento?: string | null;
  ativo?: boolean;
};

export interface SetorRepository {
  criarSetor(dados: NovoSetor): Promise<string>;
  listarSetores(orgaoId: string): Promise<SetorResumo[]>;
  buscarSetor(orgaoId: string, id: string): Promise<SetorResumo | null>;
  atualizarSetor(orgaoId: string, id: string, dados: EdicaoSetor): Promise<void>;
  contarVinculosSetor(orgaoId: string, id: string): Promise<Record<string, number>>;
  removerSetor(orgaoId: string, id: string): Promise<void>;
  pertenceAoOrgao(setorId: string, orgaoId: string): Promise<boolean>;
  criarDepartamento(dados: NovoDepartamento): Promise<string>;
  listarDepartamentos(setorId: string): Promise<DepartamentoResumo[]>;
  atualizarDepartamento(setorId: string, id: string, dados: EdicaoDepartamento): Promise<void>;
  contarVinculosDepartamento(id: string): Promise<Record<string, number>>;
  removerDepartamento(setorId: string, id: string): Promise<void>;
}
