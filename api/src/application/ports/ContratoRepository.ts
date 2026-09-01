import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

export type NovoItemContrato = {
  produto: string;
  descricao?: string;
  /**
   * Agrupador dentro do contrato — "Saúde", "Educação", "Limpeza".
   *
   * Texto livre e opcional: a maior parte dos contratos tem uma frente só,
   * e exigir categoria neles seria pedir que alguém escreva "Geral" mil
   * vezes. Item sem categoria cai num bloco à parte, no fim da lista.
   */
  categoria?: string | null;
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
  /**
   * Agrupador dentro do contrato — "Saúde", "Educação", "Limpeza".
   *
   * Texto livre e opcional: a maior parte dos contratos tem uma frente só,
   * e exigir categoria neles seria pedir que alguém escreva "Geral" mil
   * vezes. Item sem categoria cai num bloco à parte, no fim da lista.
   */
  categoria: string | null;
  unidadeMedida: string;
  marca: string | null;
  quantidadeTotal: number;
  saldoDisponivel: number;
  modoMedicao: string;
  valorUnitario: number;
  valorTotal: number;
};

/**
 * O que se pode corrigir num item já gravado.
 *
 * Tudo, inclusive quantidade e valor: a planilha entra por colagem, e erro de
 * digitação em preço só aparece depois. A única trava é o saldo — ver
 * `EditarItemDoContrato`.
 */
export type EdicaoItemContrato = {
  produto: string;
  descricao?: string | null;
  categoria?: string | null;
  unidadeMedida: string;
  marca?: string | null;
  quantidadeTotal: number;
  modoMedicao: "UNIDADE" | "PERCENTUAL" | "VALOR";
  valorUnitario: number;
  valorTotal: number;
};

// Só campos administrativos: número e valor ficam de fora de propósito, porque
// solicitações já emitidas dependem deles. Os **itens** passaram a ser
// editáveis um a um, por `EditarItemDoContrato`.
export type EdicaoContrato = {
  dataInicio?: string;
  dataFim?: string | null;
  fiscalNomeMatricula?: string | null;
  unidadesDestinadas?: string[];
  /**
   * O valor do contrato assinado, digitado — não a soma dos itens.
   *
   * Os dois números são separados de propósito: o arredondamento do edital nem
   * sempre bate com a soma dos itens, e a tela mostra os dois avisando quando
   * divergem. Editável porque, sem isso, o aviso apontaria um problema sem
   * conserto — e porque é ele que o teto da licitação mede.
   */
  valorTotal?: number;
};

export type ContratoDetalhe = ContratoResumo & {
  processoId: string | null;
  /** De onde o contrato nasceu; é a licitação que impõe o teto. */
  licitacaoId: string | null;
};

/** Contrato com tudo que a tela de detalhe mostra numa vez só. */
export type ContratoCompleto = ContratoResumo & {
  processoId: string | null;
  fornecedorRazaoSocial: string;
  fornecedorDocumento: string;
  fornecedorEndereco: string | null;
  fornecedorEmail: string | null;
  fornecedorTelefone: string | null;
  fornecedorInscricaoEstadual: string | null;
  /** Nulo quando a origem é ata: modalidade é da licitação. */
  origemModalidade: string | null;
  origemValor: number | null;
  origemData: string | null;
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

/** Um item com o que já saiu dele — é o consumo que decide o que pode mudar. */
export type ItemDoContrato = ItemComSaldo & {
  contratoId: string;
  /**
   * Quanto já foi reservado por solicitações: a diferença entre o total e o
   * saldo. Guardado assim, e não recontado das solicitações, porque é o mesmo
   * número que o banco usa para manter `saldo_disponivel >= 0`.
   */
  consumido: number;
};

export interface ContratoRepository {
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
  listarParaSolicitacao(
    orgaoId: string, unidadeId?: string, busca?: string,
  ): Promise<ContratoParaSolicitacao[]>;
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
  /**
   * Quanto a licitação autorizou e quanto dela já virou contrato.
   *
   * `exceto` tira um contrato da soma — é o que está sendo editado, e contá-lo
   * duas vezes faria toda edição de contrato no teto ser recusada.
   */
  tetoDaLicitacao(
    orgaoId: string, licitacaoId: string, exceto?: string,
  ): Promise<{ valorLicitacao: number; jaContratado: number } | null>;
  listarItens(orgaoId: string, contratoId: string): Promise<ItemComSaldo[]>;
  buscarItem(orgaoId: string, itemId: string): Promise<ItemDoContrato | null>;
  atualizarItem(orgaoId: string, itemId: string, dados: EdicaoItemContrato): Promise<void>;
  removerItem(orgaoId: string, itemId: string): Promise<void>;
  buscar(orgaoId: string, id: string): Promise<ContratoDetalhe | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoContrato): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string, tx: Tx): Promise<void>;
}
