export type UnidadeSaude = {
  id: string;
  nome: string;
  codigoCnes: string | null;
  tipoUnidade: number | null;
  endereco: string | null;
  telefone: string | null;
  cnesConsultadoEm: string | null;
  unidadeId: string | null;
  ativo: boolean;
};

export type DadosDaUnidadeSaude = {
  nome: string;
  codigoCnes?: string | null;
  tipoUnidade?: number | null;
  endereco?: string | null;
  telefone?: string | null;
  unidadeId?: string | null;
  /** Preenchido quando os dados vieram do CNES, para a tela datar a origem. */
  cnesConsultadoEm?: Date | null;
};

export interface UnidadeSaudeRepository {
  listar(orgaoId: string, apenasAtivas: boolean): Promise<UnidadeSaude[]>;
  porId(orgaoId: string, id: string): Promise<UnidadeSaude | null>;
  criar(orgaoId: string, dados: DadosDaUnidadeSaude): Promise<string>;
  atualizar(orgaoId: string, id: string, dados: DadosDaUnidadeSaude): Promise<boolean>;
  /** O CNES já está cadastrado nesta prefeitura? Dois cadastros partem a série. */
  porCnes(orgaoId: string, codigoCnes: string): Promise<UnidadeSaude | null>;
}
