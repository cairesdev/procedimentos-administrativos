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

export type EdicaoAta = Partial<Omit<NovaAta, "orgaoId" | "itens" | "licitacaoId">> & {
  itens?: NovoItemAta[];
  licitacaoId?: string | null;
};

export interface AtaRepository {
  existeNumero(orgaoId: string, numero: string, ignorarId?: string): Promise<boolean>;
  buscar(orgaoId: string, id: string): Promise<AtaResumo | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoAta, tx: Tx): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string, tx: Tx): Promise<void>;
  criar(dados: NovaAta, tx: Tx): Promise<string>;
  listar(orgaoId: string): Promise<AtaResumo[]>;
  listarItens(orgaoId: string, ataId: string): Promise<ItemDeAta[]>;
}
