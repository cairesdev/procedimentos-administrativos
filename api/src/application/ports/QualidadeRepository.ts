import type { AlcanceDeConsulta } from "./AlmoxarifadoRepository";
export type RegistroDeQualidade = {
  id: string;
  loteId: string | null;
  estoqueLocalId: string | null;
  produtoNome: string;
  unidadeMedida: string;
  /** Onde o material está: o almoxarifado ou a unidade que o recebeu. */
  ondeEsta: string;
  tipo: string;
  observacao: string;
  quantidade: number | null;
  usuarioNome: string;
  data: string;
};

export type NovoRegistroDeQualidade = {
  loteId?: string;
  estoqueLocalId?: string;
  tipo: string;
  observacao: string;
  quantidade?: number;
  usuarioId: string;
};

export interface QualidadeRepository {
  registrar(dados: NovoRegistroDeQualidade): Promise<string>;
  listar(
    orgaoId: string,
    filtros: { lote?: string; estoqueLocal?: string; tipo?: string },
    alcance: AlcanceDeConsulta,
  ): Promise<RegistroDeQualidade[]>;
  /** O lote (ou o estoque da unidade) pertence a este órgão? */
  loteDoOrgao(orgaoId: string, loteId?: string, estoqueLocalId?: string): Promise<boolean>;
}
