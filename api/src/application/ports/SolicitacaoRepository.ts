import type { Pagina, Paginacao } from "../shared/Paginacao";
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

/** Linha da listagem: o essencial para achar a solicitação. */
export type SolicitacaoResumo = {
  id: string;
  situacao: "RASCUNHO" | "ENVIADA";
  unidadeSolicitanteId: string;
  unidadeSolicitanteNome: string;
  processoId: string | null;
  numeroProtocolo: string | null;
  numeroProcessoAdm: string | null;
  statusProcesso: string | null;
  criadaEm: string;
  /** Contagem, para a listagem. O detalhe traz a lista em `itens`. */
  totalItens: number;
  valorTotal: number;
};

/** Item da solicitação com tudo que veio do contrato de origem. */
export type ItemDaSolicitacao = {
  itemId: string;
  contratoId: string;
  produto: string;
  descricao: string | null;
  unidadeMedida: string;
  marca: string | null;
  /** Agrupador do item dentro do contrato. Nulo quando o contrato não usa. */
  categoria: string | null;
  modoMedicao: "UNIDADE" | "PERCENTUAL" | "VALOR";
  valorUnitario: number;
  quantidadeSolicitada: number;
  valorCalculado: number;
  /** Estado atual do item no contrato, para conferir o que sobrou. */
  quantidadeTotalContratada: number;
  saldoDisponivel: number;
};

/** Contrato de origem dos itens, com fornecedor e vigência. */
export type ContratoDaSolicitacao = {
  id: string;
  numero: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
  fiscalNomeMatricula: string | null;
  fornecedorId: string;
  fornecedorRazaoSocial: string;
  fornecedorDocumento: string;
  fornecedorEmail: string | null;
  fornecedorTelefone: string | null;
  origem: "LICITACAO" | "ATA";
  origemNumero: string | null;
  origemId: string | null;
  licitacaoDaAtaId: string | null;
  licitacaoDaAtaNumero: string | null;
};

export type SolicitacaoCompleta = SolicitacaoResumo & {
  itens: ItemDaSolicitacao[];
  contratos: ContratoDaSolicitacao[];
};

export interface SolicitacaoRepository {
  listar(
    orgaoId: string,
    filtros: { situacao?: string; unidadeId?: string },
    paginacao: Paginacao,
  ): Promise<Pagina<SolicitacaoResumo>>;
  buscarCompleta(orgaoId: string, id: string): Promise<SolicitacaoCompleta | null>;
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
