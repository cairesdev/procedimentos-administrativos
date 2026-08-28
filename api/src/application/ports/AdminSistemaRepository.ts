export type AdminAutenticavel = {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  ativo: boolean;
};

export type NovoOrgao = {
  cnpj: string;
  nome: string;
  uf: string;
  municipio: string;
  endereco?: string;
};

export type OrgaoResumo = {
  id: string;
  cnpj: string;
  nome: string;
  uf: string;
  municipio: string;
  endereco: string | null;
  ativo: boolean;
  modulos: string[];
  usuarios: number;
};

// endereco aceita null para limpar o campo.
export type EdicaoOrgao = Partial<Omit<NovoOrgao, "endereco">> & {
  endereco?: string | null;
  ativo?: boolean;
};

/**
 * Duas logomarcas: prefeitura costuma imprimir o brasão do município de um
 * lado e a marca do programa ou da secretaria do outro — FUNDEB, PNAE,
 * "Governo do Estado".
 */
export type LadoDaLogomarca = "ESQUERDA" | "DIREITA";

export type TimbreDoOrgao = {
  arquivoLogomarca: string | null;
  arquivoLogomarcaDireita: string | null;
  cabecalhoTimbre: string | null;
  rodapeTimbre: string | null;
};

/** Usuário com papel ADMIN dentro de uma prefeitura. */
export type AdministradorDaEntidade = {
  id: string;
  nome: string;
  email: string;
  username: string;
  ativo: boolean;
  criadoEm: string;
};

/** Administrador do produto (tabela `admin_sistema`), fora do isolamento por órgão. */
export type AdminDoSistema = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
};

export type NovoAdminDoSistema = {
  nome: string;
  email: string;
  senhaHash: string;
};

export interface AdminSistemaRepository {
  buscarPorEmail(email: string): Promise<AdminAutenticavel | null>;
  buscarAdminPorId(id: string): Promise<AdminDoSistema | null>;
  listarAdminsDoSistema(): Promise<AdminDoSistema[]>;
  contarAdminsDoSistemaAtivos(ignorarId?: string): Promise<number>;
  criarAdminDoSistema(dados: NovoAdminDoSistema): Promise<string>;
  atualizarAdminDoSistema(
    id: string,
    dados: { nome?: string; senhaHash?: string; ativo?: boolean },
  ): Promise<void>;
  listarAdministradores(orgaoId: string): Promise<AdministradorDaEntidade[]>;
  /** Quantos ADMIN ativos a prefeitura tem, para não deixá-la sem nenhum. */
  contarAdministradoresAtivos(orgaoId: string, ignorarId?: string): Promise<number>;
  listarOrgaos(): Promise<OrgaoResumo[]>;
  buscarOrgao(id: string): Promise<OrgaoResumo | null>;
  existeCnpj(cnpj: string, ignorarId?: string): Promise<boolean>;
  criarOrgao(dados: NovoOrgao): Promise<string>;
  atualizarOrgao(id: string, dados: EdicaoOrgao): Promise<void>;
  definirModulos(orgaoId: string, modulos: string[]): Promise<void>;
  buscarTimbre(orgaoId: string): Promise<TimbreDoOrgao | null>;
  salvarTimbre(orgaoId: string, dados: TimbreDoOrgao): Promise<void>;
}
