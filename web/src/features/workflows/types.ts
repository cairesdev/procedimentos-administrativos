export type WorkflowStep = {
  ordem: number;
  setorId: string;
  departamentoId: string | null;
  prazoDias: number | null;
  prazoAtivo: boolean;
  visibilidadeEstendida: boolean;
};

export type Workflow = {
  orgaoId: string;
  tipoProcesso: string;
  permiteOverrideUsuario: boolean;
  etapas: WorkflowStep[];
};

export const PROCESS_TYPES = [
  "SOLICITACAO_ITENS",
  "PEDIDO_INFORMACAO",
  "ATENDIMENTO_EXTERNO",
  "OUTRO",
] as const;
