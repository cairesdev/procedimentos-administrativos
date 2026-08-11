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
  processoId: string;
  numero: string;
  fornecedorId: string;
  licitacaoId?: string;
  ataId?: string;
  dataInicio: string;
  dataFim: string;
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
  dataFim: string;
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

export interface ContratoRepository {
  existeNumero(orgaoId: string, numero: string): Promise<boolean>;
  criar(dados: NovoContrato, tx: Tx): Promise<string>;
  listar(orgaoId: string): Promise<ContratoResumo[]>;
  unidadeTemAcesso(contratoId: string, unidadeId: string): Promise<boolean>;
  listarItens(orgaoId: string, contratoId: string): Promise<ItemComSaldo[]>;
}
