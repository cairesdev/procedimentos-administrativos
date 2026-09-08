import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";

// Só eventos de negócio — nunca edição simples de cadastro.
export type TipoEvento =
  | "CONTRATO_CRIADO"
  // Itens do contrato passaram a ser corrigíveis: o antes e o depois ficam
  // na trilha, porque mudam o valor do que já foi contratado.
  | "ITEM_CONTRATO_EDITADO"
  | "ITEM_CONTRATO_EXCLUIDO"
  | "SOLICITACAO_ENVIADA"
  | "SOLICITACAO_CANCELADA"
  | "PROCESSO_DESPACHADO"
  | "PROCESSO_MOVIDO"
  | "PARECER_EMITIDO"
  | "ORDEM_EMITIDA"
  // A nota chega dias depois da ordem; quem a informou fica registrado.
  | "NOTA_FISCAL_INFORMADA"
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
  | "DOCUMENTO_PREPARADO"
  | "DOCUMENTO_EDITADO"
  | "DOCUMENTO_DESCARTADO"
  | "DOCUMENTO_EMITIDO"
  | "DOCUMENTO_CANCELADO"
  // Almoxarifado: entrada, o ciclo do pedido e a perda no recebimento.
  | "ENTRADA_ESTOQUE_REGISTRADA"
  // Implantação: o cadastro de escolas do sistema antigo, colado de uma vez.
  | "LOCAIS_IMPORTADOS"
  | "LOTE_ESTOQUE_EXCLUIDO"
  | "SOLICITACAO_ESTOQUE_ENVIADA"
  | "SOLICITACAO_ESTOQUE_LIBERADA"
  | "SOLICITACAO_ESTOQUE_RECEBIDA"
  | "SOLICITACAO_ESTOQUE_RECUSADA"
  | "SOLICITACAO_ESTOQUE_CANCELADA"
  | "SOLICITACAO_ESTOQUE_EXPIRADA"
  // 2ª fatia: o que acontece com o estoque depois que ele chega.
  | "CONSUMO_ESTOQUE_REGISTRADO"
  | "DEVOLUCAO_ESTOQUE_PEDIDA"
  | "DEVOLUCAO_ESTOQUE_ACEITA"
  | "DEVOLUCAO_ESTOQUE_RECUSADA"
  | "TRANSFERENCIA_ESTOQUE_REGISTRADA"
  | "AJUSTE_ESTOQUE_REGISTRADO"
  | "QUALIDADE_REGISTRADA"
  // O fornecedor é cadastro global, mas quem convidou responde pelo que ele
  // alterou: os três eventos aparecem na auditoria da prefeitura convidante.
  | "FORNECEDOR_CONVIDADO"
  | "FORNECEDOR_ATUALIZADO_POR_LINK"
  | "FORNECEDOR_CONVITE_REVOGADO"
  // Checklist: a lista criada, o item cumprido, conferido, recusado e
  // dispensado. Conferência e recusa entram porque são resposta de alguém a
  // algo que outro entregou.
  | "CHECKLIST_CRIADO"
  | "CHECKLIST_ITEM_CUMPRIDO"
  | "CHECKLIST_ITEM_ACEITO"
  | "CHECKLIST_ITEM_RECUSADO"
  | "CHECKLIST_ITEM_DISPENSADO"
  | "CHECKLIST_CONVITE_ENVIADO"
  | "CHECKLIST_CONVITE_REVOGADO"
  | "ADMIN_ENTIDADE_CRIADO"
  | "ADMIN_ENTIDADE_PROMOVIDO"
  | "ADMIN_ENTIDADE_SENHA_REDEFINIDA"
  | "ADMIN_ENTIDADE_INATIVADO"
  | "ADMIN_ENTIDADE_REATIVADO"
  | "EMAIL_CONFIGURADO"
  | "EMAIL_CONFIGURACAO_REMOVIDA"
  /**
   * Saúde — e a primeira **leitura** que esta trilha registra.
   *
   * Até aqui a auditoria só guardava escrita, e de propósito: registrar quem
   * abriu qual tela produziria ruído sem ninguém para lê-lo. Prontuário é
   * outra coisa. O levantamento deixou o histórico clínico aberto a todo
   * profissional clínico, porque continuidade do cuidado depende de ver a
   * visita anterior; `PRONTUARIO_LIDO` é a contrapartida disso, e é o que
   * inibe a curiosidade sobre a ficha do vizinho.
   */
  | "PRONTUARIO_LIDO"
  | "FICHA_ABERTA"
  | "FICHA_IDENTIFICADA"
  | "TRIAGEM_REGISTRADA"
  | "AVALIACAO_MEDICA_REGISTRADA"
  | "EXAME_SOLICITADO"
  | "RESULTADO_DE_EXAME_INFORMADO"
  | "PRESCRICAO_REGISTRADA"
  | "MEDICACAO_ADMINISTRADA"
  | "EVOLUCAO_REGISTRADA"
  | "PROCEDIMENTO_REGISTRADO"
  | "ATENDIMENTO_ENCERRADO"
  | "REGISTRO_CLINICO_RETIFICADO"
  /**
   * Programas de cuidado continuado.
   *
   * `RELATORIO_DE_PROGRAMA_APURADO` é a segunda leitura que esta trilha
   * registra, pelo mesmo motivo da primeira: o relatório reúne situação e CID
   * de todo mundo do programa numa página só, e é ele que vai anexado ao
   * ofício do Ministério Público. Quem o emitiu fica registrado.
   */
  | "INSCRICAO_EM_PROGRAMA"
  | "SITUACAO_NO_PROGRAMA_ALTERADA"
  | "TERAPIA_INDICADA"
  | "TERAPIA_INICIADA"
  | "TERAPIA_ENCERRADA"
  | "SESSAO_REGISTRADA"
  | "EQUIPE_DO_PROGRAMA_ALTERADA"
  | "RELATORIO_DE_PROGRAMA_APURADO";

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
