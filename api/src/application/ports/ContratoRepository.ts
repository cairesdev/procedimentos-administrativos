import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

export type NovoItemContrato = {
  produto: string;
  descricao?: string;
  unidadeMedida: string;
  marca?: string;
  quantidadeTotal: number;
  modoMedicao: "UNIDADE" | "PERCENTUAL" | "VALOR";
  valorUnitario: number;
  valorTotal: number;
};

export type NovoContrato = {
  orgaoId: string;
  numero: string;
  fornecedorId: string;
  licitacaoId?: string;
  ataId?: string;
  dataInicio: string;
  dataFim?: string;
  valorTotal: number;
  fiscalNomeMatricula?: string;
  unidadesDestinadas: string[];
  itens: NovoItemContrato[];
};

export type ContratoResumo = {
  id: string;
  numero: string;
  fornecedorId: string;
  dataInicio: string;
  /** Nulo = vigência indeterminada. */
  dataFim: string | null;
  valorTotal: number;
};

export type ItemComSaldo = {
  id: string;
  produto: string;
  descricao: string | null;
  unidadeMedida: string;
  marca: string | null;
  quantidadeTotal: number;
  saldoDisponivel: number;
  modoMedicao: string;
  valorUnitario: number;
  valorTotal: number;
};

// Só campos administrativos: número, valor e itens ficam de fora de propósito,
// porque solicitações já emitidas dependem deles.
export type EdicaoContrato = {
  dataInicio?: string;
  dataFim?: string | null;
  fiscalNomeMatricula?: string | null;
  unidadesDestinadas?: string[];
};

export type ContratoDetalhe = ContratoResumo & { processoId: string | null };

/** Contrato com tudo que a tela de detalhe mostra numa vez só. */
export type ContratoCompleto = ContratoResumo & {
  processoId: string | null;
  fornecedorRazaoSocial: string;
  fornecedorDocumento: string;
  fiscalNomeMatricula: string | null;
  /** De onde o contrato nasceu: licitação ou ata de registro de preços. */
  origem: "LICITACAO" | "ATA";
  origemId: string | null;
  origemNumero: string | null;
  origemObjeto: string | null;
  /** Ata sempre nasce de uma licitação; guarda o rastro até ela. */
  licitacaoDaAtaId: string | null;
  licitacaoDaAtaNumero: string | null;
  unidades: { id: string; nome: string }[];
  itens: ItemComSaldo[];
  /** Quantas solicitações já consumiram este contrato. */
  solicitacoes: number;
};

/** Contrato oferecido na montagem da solicitação, já filtrado pela unidade. */
export type ContratoParaSolicitacao = {
  id: string;
  numero: string;
  /** Vem da ata ou da licitação: o contrato não tem objeto próprio. */
  objeto: string;
  fornecedorRazaoSocial: string;
  dataInicio: string;
  dataFim: string | null;
  valorTotal: number;
  origem: "LICITACAO" | "ATA";
  origemNumero: string | null;
  /** Só itens com saldo entram na conta. */
  itensDisponiveis: number;
  /** Quanto ainda dá para pedir, em dinheiro. */
  saldoDisponivel: number;
};

export interface ContratoRepository {
  existeNumero(orgaoId: string, numero: string): Promise<boolean>;
  criar(dados: NovoContrato, tx: Tx): Promise<string>;
  listar(
    orgaoId: string,
    paginacao: Paginacao,
    filtros?: { unidadeId?: string },
  ): Promise<Pagina<ContratoResumo>>;
  buscarCompleto(orgaoId: string, id: string): Promise<ContratoCompleto | null>;
  /**
   * Contratos que a unidade pode usar: vigentes, com item em saldo e
   * destinados a ela. Sem `unidadeId`, todos os vigentes do órgão.
   */
  listarParaSolicitacao(orgaoId: string, unidadeId?: string): Promise<ContratoParaSolicitacao[]>;
  unidadeTemAcesso(contratoId: string, unidadeId: string): Promise<boolean>;
  /**
   * Números dos contratos que NÃO estão destinados à unidade. Em uma consulta
   * só: a solicitação mistura vários contratos e uma pergunta por contrato
   * multiplicaria idas ao banco no caminho mais quente do sistema.
   */
  contratosForaDaUnidade(
    orgaoId: string,
    contratoIds: string[],
    unidadeId: string,
  ): Promise<string[]>;
  listarItens(orgaoId: string, contratoId: string): Promise<ItemComSaldo[]>;
  buscar(orgaoId: string, id: string): Promise<ContratoDetalhe | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoContrato): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string, tx: Tx): Promise<void>;
}
