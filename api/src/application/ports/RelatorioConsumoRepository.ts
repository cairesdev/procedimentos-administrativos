import type { AlcanceDeConsulta } from "./AlmoxarifadoRepository";
/** Recorte pedido: o relatório guarda isto, e apura o resto na leitura. */
export type RelatorioConsumo = {
  id: string;
  almoxarifadoId: string;
  almoxarifadoNome: string;
  tipoEstoqueId: string | null;
  tipoEstoqueNome: string | null;
  periodoInicio: string;
  periodoFim: string;
  criadoPorNome: string | null;
  criadoEm: string;
};

/** Uma linha por unidade atendida no período. */
export type MovimentoDaUnidade = {
  localId: string;
  nome: string;
  cnpj: string | null;
  /** O que a unidade **confirmou** ter recebido, não o que foi despachado. */
  recebido: number;
  consumido: number;
  perdido: number;
  /** Só devolução aceita: pendente não voltou, recusada não volta. */
  devolvido: number;
  /** Saldo de hoje no armário da unidade, não do fim do período. */
  saldo: number;
};

export type MovimentoDoProduto = {
  produtoId: string;
  nome: string;
  unidadeMedida: string;
  recebido: number;
  consumido: number;
  perdido: number;
  devolvido: number;
};

export type ApuracaoDoRelatorio = RelatorioConsumo & {
  unidades: MovimentoDaUnidade[];
  produtos: MovimentoDoProduto[];
  /** Remessas que entraram no período, e quantas vieram da agricultura familiar. */
  entradasTotal: number;
  entradasAgriculturaFamiliar: number;
};

export type NovoRelatorioConsumo = {
  orgaoId: string;
  usuarioId: string;
  almoxarifadoId: string;
  tipoEstoqueId?: string;
  periodoInicio: string;
  periodoFim: string;
};

export interface RelatorioConsumoRepository {
  criar(dados: NovoRelatorioConsumo): Promise<string>;
  listar(orgaoId: string, alcance: AlcanceDeConsulta): Promise<RelatorioConsumo[]>;
  /** Os números do recorte, calculados no momento da leitura. */
  apurar(
    orgaoId: string, id: string, alcance: AlcanceDeConsulta,
  ): Promise<ApuracaoDoRelatorio | null>;
  excluir(orgaoId: string, id: string): Promise<void>;
}
