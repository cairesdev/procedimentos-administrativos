export type NovaUnidade = { orgaoId: string; nome: string; sigla?: string };
export type UnidadeResumo = { id: string; nome: string; sigla: string | null; ativo: boolean };

export interface UnidadeRepository {
  criar(dados: NovaUnidade): Promise<string>;
  listar(orgaoId: string): Promise<UnidadeResumo[]>;
}

export type TipoSetor =
  | "PROTOCOLO" | "COMPRAS" | "CONTROLADORIA"
  | "ALIMENTACAO_ESCOLAR" | "FROTAS" | "PATRIMONIO" | "OPERACIONAL";

export type NovoSetor = { orgaoId: string; nome: string; tipo: TipoSetor };
export type SetorResumo = { id: string; nome: string; tipo: TipoSetor; ativo: boolean };

export type NovoDepartamento = { setorId: string; nome: string; categoriaAtendimento?: string };
export type DepartamentoResumo = { id: string; nome: string; categoriaAtendimento: string | null; ativo: boolean };

export interface SetorRepository {
  criarSetor(dados: NovoSetor): Promise<string>;
  listarSetores(orgaoId: string): Promise<SetorResumo[]>;
  pertenceAoOrgao(setorId: string, orgaoId: string): Promise<boolean>;
  criarDepartamento(dados: NovoDepartamento): Promise<string>;
  listarDepartamentos(setorId: string): Promise<DepartamentoResumo[]>;
}
