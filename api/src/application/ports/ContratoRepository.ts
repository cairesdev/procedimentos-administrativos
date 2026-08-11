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

// Só campos administrativos: número, valor e itens ficam de fora de propósito,
// porque solicitações já emitidas dependem deles.
export type EdicaoContrato = {
  dataInicio?: string;
  dataFim?: string;
  fiscalNomeMatricula?: string | null;
  unidadesDestinadas?: string[];
};

export type ContratoDetalhe = ContratoResumo & { processoId: string };

export interface ContratoRepository {
  existeNumero(orgaoId: string, numero: string): Promise<boolean>;
  criar(dados: NovoContrato, tx: Tx): Promise<string>;
  listar(orgaoId: string): Promise<ContratoResumo[]>;
  unidadeTemAcesso(contratoId: string, unidadeId: string): Promise<boolean>;
  listarItens(orgaoId: string, contratoId: string): Promise<ItemComSaldo[]>;
  buscar(orgaoId: string, id: string): Promise<ContratoDetalhe | null>;
  atualizar(orgaoId: string, id: string, dados: EdicaoContrato): Promise<void>;
  contarVinculos(orgaoId: string, id: string): Promise<Record<string, number>>;
  remover(orgaoId: string, id: string, tx: Tx): Promise<void>;
}
