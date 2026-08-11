import type { Tx } from "./Transacao";

export type NovoProcesso = {
  orgaoId: string;
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  tipoProcesso: "SOLICITACAO_ITENS" | "PEDIDO_INFORMACAO" | "ATENDIMENTO_EXTERNO" | "CONTRATO" | "OUTRO";
  setorAtualId?: string;
  departamentoAtualId?: string;
};

export interface ProcessoRepository {
  criar(dados: NovoProcesso, tx: Tx): Promise<string>;
  cancelar(orgaoId: string, processoId: string, tx: Tx): Promise<void>;
}

export interface NumeracaoSequencia {
  proximoNumero(orgaoId: string, tipo: string, ano: number, tx: Tx): Promise<number>;
}
