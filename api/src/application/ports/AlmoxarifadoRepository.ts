import type { Tx } from "./Transacao";
import type { Pagina, Paginacao } from "../shared/Paginacao";

/**
 * Porta do almoxarifado.
 *
 * `solicitacao_estoque`, `lote` e `estoque_local` não têm `orgao_id` próprio:
 * alcançam o órgão por join no local, na remessa ou no almoxarifado. Toda
 * assinatura aqui recebe `orgaoId` por isso — quem implementa é obrigado a
 * amarrar, e o `WHERE id = $1` solitário não passa.
 */

export type Almoxarifado = {
  id: string;
  nome: string;
  ativo: boolean;
  locais: number;
  remessas: number;
};

/**
 * Local que consome estoque (escola, posto). É o mesmo `local` do patrimônio —
 * o prédio guarda bem tombado e mantimento, e dois cadastros do mesmo lugar
 * partiriam o endereço e o responsável em dois.
 */
export type LocalDeEstoque = {
  id: string;
  nome: string;
  codigo: string;
  /** Nulo quando o local não representa uma unidade administrativa. */
  unidadeId: string | null;
  almoxarifadoId: string | null;
  almoxarifadoNome: string | null;
  cnpj: string | null;
  endereco: string | null;
  responsavel: string | null;
};

export type TipoDeEstoque = {
  id: string;
  nome: string;
  ativo: boolean;
  remessas: number;
};

export type Produto = {
  id: string;
  nome: string;
  unidadeMedida: string;
  ativo: boolean;
};

export type NovaRemessa = {
  almoxarifadoId: string;
  codigo: string;
  titulo: string;
  data: string;
  localArmazenado?: string;
  tipoEstoqueId: string;
  responsavelUsuarioId: string;
  notaFiscal?: string;
  fornecedorId?: string;
};

export type RemessaResumo = {
  id: string;
  codigo: string;
  titulo: string;
  data: string;
  almoxarifadoNome: string;
  tipoEstoqueNome: string;
  localArmazenado: string | null;
  notaFiscal: string | null;
  fornecedorRazaoSocial: string | null;
  responsavelNome: string;
  lotes: number;
};

export type LoteDaRemessa = {
  id: string;
  produtoId: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidade: number;
  saldo: number;
  dataValidade: string | null;
};

export type NovoLote = {
  remessaId: string;
  produtoId: string;
  quantidade: number;
  dataValidade?: string | null;
};

/** Lote com saldo, para a distribuição FEFO da liberação. */
export type LoteComSaldo = {
  id: string;
  produtoId: string;
  saldo: number;
  dataValidade: string | null;
  remessaCodigo: string;
  almoxarifadoNome: string;
};

/** O que a unidade pode pedir: saldo do almoxarifado menos o já reservado. */
export type DisponibilidadeDeProduto = {
  produtoId: string;
  nome: string;
  unidadeMedida: string;
  saldoTotal: number;
  reservado: number;
  disponivel: number;
  /** Validade mais próxima entre os lotes com saldo; alerta, não bloqueio. */
  proximaValidade: string | null;
};

export type NovaSolicitacaoEstoque = {
  localSolicitanteId: string;
  autorUsuarioId: string;
  tipoEstoqueId?: string;
};

export type ItemDaSolicitacao = {
  id: string;
  produtoId: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidadeSolicitada: number;
  quantidadeReservada: number;
  saldoDaUnidadeNoMomento: number | null;
  quantidadeLiberada: number | null;
  quantidadeRecebida: number | null;
};

export type SolicitacaoEstoque = {
  id: string;
  localSolicitanteId: string;
  localSolicitanteNome: string;
  almoxarifadoId: string | null;
  autorNome: string;
  tipoEstoqueId: string | null;
  tipoEstoqueNome: string | null;
  status: string;
  data: string;
  enviadaEm: string | null;
  reservaExpiraEm: string | null;
  liberadaEm: string | null;
  recebidaEm: string | null;
  motivoRecusa: string | null;
  itens: ItemDaSolicitacao[];
};

export type SolicitacaoResumo = Omit<SolicitacaoEstoque, "itens"> & { totalItens: number };

/** Uma linha da liberação: de qual lote saiu quanto. */
export type NovaLiberacao = {
  solicitacaoItemId: string;
  loteId: string;
  quantidade: number;
};

export type LiberacaoParaConferir = {
  id: string;
  solicitacaoItemId: string;
  loteId: string;
  produtoId: string;
  produtoNome: string;
  unidadeMedida: string;
  quantidade: number;
  quantidadeConfirmada: number | null;
  dataValidade: string | null;
  remessaCodigo: string;
};

export type ConfirmacaoDeRecebimento = {
  liberacaoId: string;
  quantidadeConfirmada: number;
  motivoPerda?: string;
  observacaoPerda?: string;
};

export type ConfiguracaoDoAlmoxarifado = {
  reservaAtiva: boolean;
  reservaPrazoHoras: number;
  alertaValidadeDias: number;
};

export interface AlmoxarifadoRepository {
  // ---- Cadastros -----------------------------------------------------------
  listarAlmoxarifados(orgaoId: string): Promise<Almoxarifado[]>;
  criarAlmoxarifado(orgaoId: string, nome: string): Promise<string>;
  atualizarAlmoxarifado(orgaoId: string, id: string, dados: { nome: string; ativo: boolean }): Promise<void>;
  removerAlmoxarifado(orgaoId: string, id: string): Promise<void>;

  listarTipos(orgaoId: string): Promise<TipoDeEstoque[]>;
  criarTipo(orgaoId: string, nome: string): Promise<string>;
  atualizarTipo(orgaoId: string, id: string, dados: { nome: string; ativo: boolean }): Promise<void>;
  removerTipo(orgaoId: string, id: string): Promise<void>;

  /** Catálogo global: sem `orgaoId` de propósito. */
  listarProdutos(busca?: string): Promise<Produto[]>;
  /** Devolve o id existente quando nome e unidade já estão cadastrados. */
  garantirProduto(nome: string, unidadeMedida: string, tx?: Tx): Promise<string>;

  buscarConfiguracao(orgaoId: string): Promise<ConfiguracaoDoAlmoxarifado>;
  salvarConfiguracao(orgaoId: string, dados: ConfiguracaoDoAlmoxarifado): Promise<void>;

  /** Locais que consomem estoque, opcionalmente de um almoxarifado só. */
  listarLocais(orgaoId: string, almoxarifadoId?: string): Promise<LocalDeEstoque[]>;
  buscarLocal(orgaoId: string, localId: string): Promise<LocalDeEstoque | null>;
  /** Dados de entrega e prestação de contas; o resto do local é do patrimônio. */
  salvarDadosDoLocal(orgaoId: string, localId: string, dados: {
    almoxarifadoId: string | null;
    cnpj?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    municipio?: string | null;
    uf?: string | null;
    cep?: string | null;
    telefone?: string | null;
    email?: string | null;
    responsavel?: string | null;
  }): Promise<void>;

  // ---- Entrada -------------------------------------------------------------
  listarRemessas(orgaoId: string, filtros: Paginacao & {
    almoxarifado?: string; tipo?: string; busca?: string;
  }): Promise<Pagina<RemessaResumo>>;
  buscarRemessa(orgaoId: string, id: string): Promise<(RemessaResumo & { lotes: LoteDaRemessa[] }) | null>;
  criarRemessa(orgaoId: string, dados: NovaRemessa, tx?: Tx): Promise<string>;
  codigoDeRemessaEmUso(orgaoId: string, almoxarifadoId: string, codigo: string): Promise<boolean>;
  adicionarLote(orgaoId: string, dados: NovoLote, tx?: Tx): Promise<string>;
  removerLote(orgaoId: string, loteId: string): Promise<void>;
  /** Lote com movimento não some: sumiria o rastro de quem já recebeu. */
  loteTemMovimento(orgaoId: string, loteId: string): Promise<boolean>;

  // ---- Disponibilidade e solicitação ---------------------------------------
  listarDisponiveis(
    orgaoId: string,
    almoxarifadoId: string,
    tipoEstoqueId?: string,
  ): Promise<DisponibilidadeDeProduto[]>;

  listarSolicitacoes(orgaoId: string, filtros: Paginacao & {
    status?: string; local?: string; almoxarifado?: string;
  }): Promise<Pagina<SolicitacaoResumo>>;
  buscarSolicitacao(orgaoId: string, id: string): Promise<SolicitacaoEstoque | null>;
  criarSolicitacao(orgaoId: string, dados: NovaSolicitacaoEstoque): Promise<string>;
  substituirItens(
    orgaoId: string,
    solicitacaoId: string,
    itens: { produtoId: string; quantidadeSolicitada: number }[],
  ): Promise<void>;
  removerSolicitacao(orgaoId: string, id: string): Promise<void>;

  /**
   * Lotes com saldo, só para exibir. Sem trava: segurar o lote enquanto o
   * almoxarife decide na tela prenderia o estoque pelo tempo que ele levar.
   */
  listarLotesComSaldo(
    orgaoId: string,
    almoxarifadoId: string,
    produtoIds: string[],
  ): Promise<LoteComSaldo[]>;

  /**
   * O mesmo, travado para escrita. `FOR UPDATE`: sem isto, duas liberações
   * simultâneas leem o mesmo saldo e as duas debitam, deixando o lote negativo.
   */
  bloquearLotesDoProduto(
    orgaoId: string,
    almoxarifadoId: string,
    produtoIds: string[],
    tx: Tx,
  ): Promise<LoteComSaldo[]>;

  /** Quanto do produto está preso por solicitações enviadas e ainda não atendidas. */
  reservasPorProduto(
    orgaoId: string,
    almoxarifadoId: string,
    produtoIds: string[],
    tx?: Tx,
  ): Promise<Record<string, number>>;

  marcarEnviada(
    orgaoId: string,
    solicitacaoId: string,
    reservaExpiraEm: Date | null,
    reservas: { itemId: string; quantidade: number }[],
    tx: Tx,
  ): Promise<void>;

  // ---- Liberação e recebimento ---------------------------------------------
  debitarLote(loteId: string, quantidade: number, tx: Tx): Promise<void>;
  registrarLiberacoes(liberacoes: NovaLiberacao[], tx: Tx): Promise<void>;
  marcarLiberada(
    orgaoId: string,
    solicitacaoId: string,
    usuarioId: string,
    liberadoPorItem: { itemId: string; quantidade: number }[],
    tx: Tx,
  ): Promise<void>;

  listarLiberacoes(orgaoId: string, solicitacaoId: string): Promise<LiberacaoParaConferir[]>;
  confirmarRecebimento(
    orgaoId: string,
    solicitacaoId: string,
    usuarioId: string,
    confirmacoes: ConfirmacaoDeRecebimento[],
    tx: Tx,
  ): Promise<void>;

  recusar(orgaoId: string, solicitacaoId: string, usuarioId: string, motivo: string): Promise<void>;
  cancelar(orgaoId: string, solicitacaoId: string, tx: Tx): Promise<void>;

  /** Solicitações cuja reserva venceu — devolve o saldo e marca EXPIRADA. */
  expirarReservasVencidas(): Promise<number>;

  // ---- Estoque da unidade --------------------------------------------------
  listarEstoqueDoLocal(orgaoId: string, localId: string): Promise<{
    produtoId: string;
    produtoNome: string;
    unidadeMedida: string;
    saldo: number;
    lotes: { id: string; saldo: number; dataValidade: string | null; dataEntrada: string }[];
  }[]>;
}
