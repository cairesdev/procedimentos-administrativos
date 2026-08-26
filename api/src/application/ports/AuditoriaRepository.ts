import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

// Só eventos de negócio — nunca edição simples de cadastro.
export type TipoEvento =
  | "CONTRATO_CRIADO"
  | "SOLICITACAO_ENVIADA"
  | "SOLICITACAO_CANCELADA"
  | "PROCESSO_DESPACHADO"
  | "PROCESSO_MOVIDO"
  | "PARECER_EMITIDO"
  | "ORDEM_EMITIDA"
  | "ANEXO_ADICIONADO"
  | "ANEXO_REMOVIDO"
  | "BENS_TOMBADOS"
  | "ENTRADA_PATRIMONIO_EXCLUIDA"
  | "BEM_EXCLUIDO"
  | "INVENTARIO_CONCLUIDO"
  | "TRANSFERENCIA_ENVIADA"
  | "TRANSFERENCIA_ACEITA"
  | "TRANSFERENCIA_RECUSADA"
  | "BEM_BAIXADO"
  | "VIAGEM_APROVADA"
  | "VIAGEM_RECUSADA"
  | "VIAGEM_REMARCADA"
  | "VIAGEM_CANCELADA"
  | "VIAGEM_RETIRADA"
  | "VIAGEM_FINALIZADA"
  | "MANUTENCAO_ABERTA"
  | "MANUTENCAO_ENCERRADA"
  | "ATENDIMENTO_ABERTO"
  | "EXIGENCIA_REGISTRADA"
  | "EXIGENCIA_RESPONDIDA"
  | "EXIGENCIA_CANCELADA"
  | "DOCUMENTO_EMITIDO"
  | "DOCUMENTO_CANCELADO"
  // Almoxarifado: entrada, o ciclo do pedido e a perda no recebimento.
  | "ENTRADA_ESTOQUE_REGISTRADA"
  | "LOTE_ESTOQUE_EXCLUIDO"
  | "SOLICITACAO_ESTOQUE_ENVIADA"
  | "SOLICITACAO_ESTOQUE_LIBERADA"
  | "SOLICITACAO_ESTOQUE_RECEBIDA"
  | "SOLICITACAO_ESTOQUE_RECUSADA"
  | "SOLICITACAO_ESTOQUE_CANCELADA"
  | "SOLICITACAO_ESTOQUE_EXPIRADA"
  // Ações do fornecedor sobre a prefeitura, visíveis na auditoria dela.
  | "ADMIN_ENTIDADE_CRIADO"
  | "ADMIN_ENTIDADE_PROMOVIDO"
  | "ADMIN_ENTIDADE_SENHA_REDEFINIDA"
  | "ADMIN_ENTIDADE_INATIVADO"
  | "ADMIN_ENTIDADE_REATIVADO";

export type EventoAuditoria = {
  orgaoId: string;
  usuarioId?: string;
  tipoEvento: TipoEvento;
  referenciaId?: string;
  detalhes?: Record<string, unknown>;
};

export type RegistroAuditoria = {
  id: string;
  tipoEvento: TipoEvento;
  referenciaId: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
  detalhes: Record<string, unknown> | null;
  data: string;
};

export type FiltroAuditoria = Paginacao & {
  orgaoId: string;
  referenciaId?: string;
  tipoEvento?: string;
  desde?: string;
  ate?: string;
};

export interface AuditoriaRepository {
  // tx opcional: dentro de transação o registro é atômico com o efeito;
  // fora dela (anexos) grava direto no pool.
  registrar(evento: EventoAuditoria, tx?: Tx): Promise<void>;
  listar(filtro: FiltroAuditoria): Promise<Pagina<RegistroAuditoria>>;
}
