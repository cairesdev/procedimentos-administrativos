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
}
