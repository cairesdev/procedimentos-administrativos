/** O recorte que todo relatório aceita. Período é obrigatório; o resto, não. */
export type FiltrosDoRelatorio = {
  periodoInicio: string;
  periodoFim: string;
  unidadeId?: string | null;
  fornecedorId?: string | null;
  modalidade?: string | null;
  setorId?: string | null;
};

export type LinhaDeContrato = {
  id: string;
  numero: string;
  fornecedor: string;
  objeto: string;
  dataInicio: string;
  dataFim: string | null;
  valorContratado: number;
  /**
   * O que já virou solicitação.
   *
   * **Não é pagamento.** O sistema registra a ordem de fornecimento, não a
   * liquidação — chamar isto de "executado" seria mentir num número que vai
   * para a prestação de contas.
   */
  valorPedido: number;
  saldo: number;
};

export type LinhaDeLicitacao = {
  id: string;
  numero: string;
  modalidade: string;
  objeto: string;
  dataAssinatura: string;
  valorTotal: number;
  contratos: number;
  valorContratado: number;
};

export type LinhaDeFornecedor = {
  id: string;
  razaoSocial: string;
  documento: string;
  contratos: number;
  valorContratado: number;
  valorPedido: number;
};

export type LinhaDeUnidade = {
  id: string;
  nome: string;
  contratos: number;
  processos: number;
  valorPedido: number;
};

export type Panorama = {
  totais: {
    licitacoes: number;
    contratos: number;
    fornecedores: number;
    valorContratado: number;
    valorPedido: number;
    saldo: number;
  };
  contratos: LinhaDeContrato[];
  licitacoes: LinhaDeLicitacao[];
  fornecedores: LinhaDeFornecedor[];
  unidades: LinhaDeUnidade[];
};

export type LinhaDeSetor = {
  id: string;
  nome: string;
  /** Passagens que começaram no período. */
  entraram: number;
  /** Passagens que terminaram no período. */
  sairam: number;
  /** Processos que estão no setor **agora** — não depende do período. */
  parados: number;
  /** Média de dias das passagens encerradas no período. */
  diasMedia: number;
  /** Dias do processo parado há mais tempo. */
  diasMaisAntigo: number;
};

export type PorSetor = {
  totais: { entraram: number; sairam: number; parados: number };
  setores: LinhaDeSetor[];
};

export interface RelatorioProcessoRepository {
  panorama(orgaoId: string, filtros: FiltrosDoRelatorio): Promise<Panorama>;
  porSetor(orgaoId: string, filtros: FiltrosDoRelatorio): Promise<PorSetor>;
  dossie(orgaoId: string, processoId: string): Promise<DossieDoProcesso | null>;
  buscarProcessos(orgaoId: string, busca: string): Promise<ProcessoEncontrado[]>;
}

/** O processo como a folha o apresenta: dados próprios e de onde ele nasceu. */
export type DossieDoProcesso = {
  processo: {
    id: string;
    numeroProtocolo: string;
    numeroProcessoAdm: string;
    tipo: string;
    status: string;
    dataAbertura: string;
    dataEncerramento: string | null;
    descricaoPedido: string | null;
    setorAtual: string | null;
    unidadeSolicitante: string | null;
  };
  /** A licitação ou ata que originou o contrato. Nulo em processo sem contrato. */
  origem: {
    tipo: "LICITACAO" | "ATA";
    numero: string;
    modalidade: string | null;
    objeto: string;
    valorTotal: number;
  } | null;
  contrato: {
    id: string;
    numero: string;
    fornecedor: string;
    documento: string;
    objeto: string;
    dataInicio: string;
    dataFim: string | null;
    valorTotal: number;
  } | null;
  itens: {
    produto: string;
    categoria: string | null;
    unidadeMedida: string;
    quantidadeSolicitada: number;
    valorCalculado: number;
    saldoDisponivel: number;
  }[];
  /** Em ordem cronológica, com quanto tempo o processo ficou em cada setor. */
  tramitacao: {
    data: string;
    setor: string;
    usuario: string;
    tipo: string;
    texto: string | null;
    diasNoSetor: number;
  }[];
  ordens: {
    numero: string;
    data: string;
    valor: number;
    numeroEmpenho: string | null;
    numeroNotaFiscal: string | null;
  }[];
  documentos: {
    id: string;
    codigo: string;
    titulo: string;
    data: string;
    emitidoPor: string;
  }[];
};

/** O processo achado pela busca — número, protocolo ou objeto. */
export type ProcessoEncontrado = {
  id: string;
  numeroProcessoAdm: string;
  numeroProtocolo: string;
  descricao: string;
  dataAbertura: string;
};
