/** Espelha TipoEvento da API. Só eventos de negócio entram na trilha. */
export const AUDIT_EVENTS = [
  "CONTRATO_CRIADO",
  "SOLICITACAO_ENVIADA",
  "SOLICITACAO_CANCELADA",
  "PROCESSO_DESPACHADO",
  "PROCESSO_MOVIDO",
  "PARECER_EMITIDO",
  "ORDEM_EMITIDA",
  "ANEXO_ADICIONADO",
  "ANEXO_REMOVIDO",
  "BENS_TOMBADOS",
  "ENTRADA_PATRIMONIO_EXCLUIDA",
  "BEM_EXCLUIDO",
  "INVENTARIO_CONCLUIDO",
  "TRANSFERENCIA_ENVIADA",
  "TRANSFERENCIA_ACEITA",
  "TRANSFERENCIA_RECUSADA",
  "BEM_BAIXADO",
  "VIAGEM_APROVADA",
  "VIAGEM_RECUSADA",
  "VIAGEM_REMARCADA",
  "VIAGEM_CANCELADA",
  "VIAGEM_RETIRADA",
  "VIAGEM_FINALIZADA",
  "MANUTENCAO_ABERTA",
  "MANUTENCAO_ENCERRADA",
  "ATENDIMENTO_ABERTO",
  "EXIGENCIA_REGISTRADA",
  "EXIGENCIA_RESPONDIDA",
  "EXIGENCIA_CANCELADA",
  "ENTRADA_ESTOQUE_REGISTRADA",
  "LOTE_ESTOQUE_EXCLUIDO",
  "SOLICITACAO_ESTOQUE_ENVIADA",
  "SOLICITACAO_ESTOQUE_LIBERADA",
  "SOLICITACAO_ESTOQUE_RECEBIDA",
  "SOLICITACAO_ESTOQUE_RECUSADA",
  "SOLICITACAO_ESTOQUE_CANCELADA",
  "SOLICITACAO_ESTOQUE_EXPIRADA",
  "CONSUMO_ESTOQUE_REGISTRADO",
  "DEVOLUCAO_ESTOQUE_PEDIDA",
  "DEVOLUCAO_ESTOQUE_ACEITA",
  "DEVOLUCAO_ESTOQUE_RECUSADA",
  "TRANSFERENCIA_ESTOQUE_REGISTRADA",
  "AJUSTE_ESTOQUE_REGISTRADO",
  "DOCUMENTO_EMITIDO",
  "DOCUMENTO_CANCELADO",
  "ADMIN_ENTIDADE_CRIADO",
  "ADMIN_ENTIDADE_PROMOVIDO",
  "ADMIN_ENTIDADE_SENHA_REDEFINIDA",
  "ADMIN_ENTIDADE_INATIVADO",
  "ADMIN_ENTIDADE_REATIVADO",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export type AuditRecord = {
  id: string;
  tipoEvento: AuditEvent;
  referenciaId: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
  detalhes: Record<string, unknown> | null;
  data: string;
};

/** Agrupa os eventos por origem, para o filtro não virar uma lista de 30 itens. */
export const EVENT_GROUPS: { group: string; events: AuditEvent[] }[] = [
  {
    group: "Processos",
    events: [
      "CONTRATO_CRIADO", "SOLICITACAO_ENVIADA", "SOLICITACAO_CANCELADA",
      "PROCESSO_DESPACHADO", "PROCESSO_MOVIDO", "PARECER_EMITIDO", "ORDEM_EMITIDA",
      "ANEXO_ADICIONADO", "ANEXO_REMOVIDO",
    ],
  },
  {
    group: "Patrimônio",
    events: [
      "BENS_TOMBADOS", "ENTRADA_PATRIMONIO_EXCLUIDA", "BEM_EXCLUIDO", "INVENTARIO_CONCLUIDO",
      "TRANSFERENCIA_ENVIADA", "TRANSFERENCIA_ACEITA", "TRANSFERENCIA_RECUSADA", "BEM_BAIXADO",
    ],
  },
  {
    group: "Frotas",
    events: [
      "VIAGEM_APROVADA", "VIAGEM_RECUSADA", "VIAGEM_REMARCADA", "VIAGEM_CANCELADA",
      "VIAGEM_RETIRADA", "VIAGEM_FINALIZADA", "MANUTENCAO_ABERTA", "MANUTENCAO_ENCERRADA",
    ],
  },
  {
    group: "Protocolo",
    events: [
      "ATENDIMENTO_ABERTO", "EXIGENCIA_REGISTRADA", "EXIGENCIA_RESPONDIDA",
      "EXIGENCIA_CANCELADA",
    ],
  },
  {
    group: "Documentos",
    events: ["DOCUMENTO_EMITIDO", "DOCUMENTO_CANCELADO"],
  },
  {
    group: "Almoxarifado",
    events: [
      "ENTRADA_ESTOQUE_REGISTRADA", "LOTE_ESTOQUE_EXCLUIDO",
      "SOLICITACAO_ESTOQUE_ENVIADA", "SOLICITACAO_ESTOQUE_LIBERADA",
      "SOLICITACAO_ESTOQUE_RECEBIDA", "SOLICITACAO_ESTOQUE_RECUSADA",
      "SOLICITACAO_ESTOQUE_CANCELADA", "SOLICITACAO_ESTOQUE_EXPIRADA",
      "CONSUMO_ESTOQUE_REGISTRADO",
      "DEVOLUCAO_ESTOQUE_PEDIDA", "DEVOLUCAO_ESTOQUE_ACEITA",
      "DEVOLUCAO_ESTOQUE_RECUSADA",
      "TRANSFERENCIA_ESTOQUE_REGISTRADA", "AJUSTE_ESTOQUE_REGISTRADO",
    ],
  },
  {
    group: "Administração",
    events: [
      "ADMIN_ENTIDADE_CRIADO", "ADMIN_ENTIDADE_PROMOVIDO", "ADMIN_ENTIDADE_SENHA_REDEFINIDA",
      "ADMIN_ENTIDADE_INATIVADO", "ADMIN_ENTIDADE_REATIVADO",
    ],
  },
];

/** Frase no lugar do enum cru: a trilha é lida por gestor, não por dev. */
export const EVENT_LABELS: Record<AuditEvent, string> = {
  CONTRATO_CRIADO: "Contrato cadastrado",
  SOLICITACAO_ENVIADA: "Solicitação enviada",
  SOLICITACAO_CANCELADA: "Solicitação cancelada",
  PROCESSO_DESPACHADO: "Processo despachado",
  PROCESSO_MOVIDO: "Processo encaminhado a outro setor",
  PARECER_EMITIDO: "Parecer emitido",
  ORDEM_EMITIDA: "Ordem de fornecimento emitida",
  ANEXO_ADICIONADO: "Anexo adicionado",
  ANEXO_REMOVIDO: "Anexo removido",
  BENS_TOMBADOS: "Bens tombados",
  ENTRADA_PATRIMONIO_EXCLUIDA: "Entrada de patrimônio excluída",
  BEM_EXCLUIDO: "Bem excluído",
  INVENTARIO_CONCLUIDO: "Inventário concluído",
  TRANSFERENCIA_ENVIADA: "Transferência enviada",
  TRANSFERENCIA_ACEITA: "Transferência aceita",
  TRANSFERENCIA_RECUSADA: "Transferência recusada",
  BEM_BAIXADO: "Bem baixado",
  VIAGEM_APROVADA: "Viagem aprovada",
  VIAGEM_RECUSADA: "Viagem recusada",
  VIAGEM_REMARCADA: "Viagem remarcada",
  VIAGEM_CANCELADA: "Viagem cancelada",
  VIAGEM_RETIRADA: "Veículo retirado",
  VIAGEM_FINALIZADA: "Viagem finalizada",
  MANUTENCAO_ABERTA: "Manutenção aberta",
  MANUTENCAO_ENCERRADA: "Manutenção encerrada",
  ATENDIMENTO_ABERTO: "Atendimento externo aberto",
  EXIGENCIA_REGISTRADA: "Exigência registrada",
  EXIGENCIA_RESPONDIDA: "Exigência respondida pelo requerente",
  EXIGENCIA_CANCELADA: "Exigência cancelada",
  ENTRADA_ESTOQUE_REGISTRADA: "Entrada de estoque registrada",
  LOTE_ESTOQUE_EXCLUIDO: "Lote de estoque excluído",
  SOLICITACAO_ESTOQUE_ENVIADA: "Pedido de material enviado",
  SOLICITACAO_ESTOQUE_LIBERADA: "Material liberado pelo almoxarifado",
  SOLICITACAO_ESTOQUE_RECEBIDA: "Recebimento confirmado pela unidade",
  SOLICITACAO_ESTOQUE_RECUSADA: "Pedido de material recusado",
  SOLICITACAO_ESTOQUE_CANCELADA: "Pedido de material cancelado",
  SOLICITACAO_ESTOQUE_EXPIRADA: "Reserva de material expirada",
  CONSUMO_ESTOQUE_REGISTRADO: "Consumo registrado pela unidade",
  DEVOLUCAO_ESTOQUE_PEDIDA: "Devolução de material solicitada",
  DEVOLUCAO_ESTOQUE_ACEITA: "Devolução aceita pelo almoxarifado",
  DEVOLUCAO_ESTOQUE_RECUSADA: "Devolução recusada",
  TRANSFERENCIA_ESTOQUE_REGISTRADA: "Transferência entre almoxarifados",
  AJUSTE_ESTOQUE_REGISTRADO: "Ajuste de estoque",
  DOCUMENTO_EMITIDO: "Documento emitido",
  DOCUMENTO_CANCELADO: "Documento cancelado",
  ADMIN_ENTIDADE_CRIADO: "Administrador criado",
  ADMIN_ENTIDADE_PROMOVIDO: "Usuário promovido a administrador",
  ADMIN_ENTIDADE_SENHA_REDEFINIDA: "Senha de administrador redefinida",
  ADMIN_ENTIDADE_INATIVADO: "Administrador inativado",
  ADMIN_ENTIDADE_REATIVADO: "Administrador reativado",
};
