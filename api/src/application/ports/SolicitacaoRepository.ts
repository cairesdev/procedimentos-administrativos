import type { Tx } from "./Transacao";

export type ItemSolicitado = {
  itemId: string;
  quantidadeSolicitada: number;
};

export type ItemContratoParaReserva = {
  id: string;
  contratoId: string;
  saldoDisponivel: number;
  modoMedicao: "UNIDADE" | "PERCENTUAL" | "VALOR";
  valorUnitario: number;
  valorTotal: number;
  quantidadeTotal: number;
};

export type SolicitacaoDetalhe = {
  id: string;
  orgaoId: string;
  processoId: string | null;
  unidadeSolicitanteId: string;
  situacao: "RASCUNHO" | "ENVIADA";
  itens: { itemId: string; quantidadeSolicitada: number; valorCalculado: number }[];
};

export interface SolicitacaoRepository {
  criarRascunho(orgaoId: string, unidadeId: string): Promise<string>;
  buscarPorId(orgaoId: string, id: string): Promise<SolicitacaoDetalhe | null>;
  buscarPorProcessoId(orgaoId: string, processoId: string): Promise<SolicitacaoDetalhe | null>;
  substituirItens(
    solicitacaoId: string,
    itens: { itemId: string; quantidadeSolicitada: number; valorCalculado: number }[],
  ): Promise<void>;
  bloquearItensContrato(orgaoId: string, itemIds: string[], tx: Tx): Promise<ItemContratoParaReserva[]>;
  debitarSaldo(itemId: string, quantidade: number, tx: Tx): Promise<void>;
  devolverSaldo(itemId: string, quantidade: number, tx: Tx): Promise<void>;
  marcarEnviada(solicitacaoId: string, processoId: string, tx: Tx): Promise<void>;
}
