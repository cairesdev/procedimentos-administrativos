import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

export type NovoItemAta = {
  produto: string;
  descricao?: string;
  unidadeMedida: string;
  marca?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type NovaAta = {
  orgaoId: string;
  licitacaoId?: string;
  numero: string;
  objeto: string;
  dataAssinatura: string;
  dataVigencia: string;
  valorTotal: number;
  itens: NovoItemAta[];
};

export type AtaResumo = {
  id: string;
  numero: string;
  objeto: string;
  licitacaoId: string | null;
  dataAssinatura: string;
  dataVigencia: string;
  valorTotal: number;
};

export type ItemDeAta = NovoItemAta & { id: string };

/** Contrato firmado a partir da ata. */
export type ContratoDaAta = {
  id: string;
  numero: string;
  fornecedorRazaoSocial: string;
  dataInicio: string;
  dataFim: string | null;
  valorTotal: number;
};

export type AtaCompleta = AtaResumo & {
  /** Ata nasce de uma licitação; o número dela fecha o rastro. */
  licitacaoNumero: string | null;
  itens: ItemDeAta[];
  contratos: ContratoDaAta[];
};

export type EdicaoAta = Partial<Omit<NovaAta, "orgaoId" | "itens" | "licitacaoId">> & {
  itens?: NovoItemAta[];
  licitacaoId?: string | null;
};

export interface AtaRepository {
  existeNumero(orgaoId: string, numero: string, ignorarId?: string): Promise<boolean>;
  buscar(orgaoId: string, id: string): Promise<AtaResumo | null>;
  /** Detalhe: itens, licitação de origem e contratos gerados. */
  buscarCompleta(orgaoId: string, id: string): Promise<AtaCompleta | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoAta, tx: Tx): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string, tx: Tx): Promise<void>;
  criar(dados: NovaAta, tx: Tx): Promise<string>;
  listar(orgaoId: string, paginacao: Paginacao): Promise<Pagina<AtaResumo>>;
  listarItens(orgaoId: string, ataId: string): Promise<ItemDeAta[]>;
}
