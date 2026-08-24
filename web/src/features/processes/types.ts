export type ProcessStatus = "ABERTO" | "TRAMITANDO" | "ENCERRADO" | "CANCELADO";

export type Process = {
  id: string;
  orgaoId: string;
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  tipoProcesso: string;
  setorAtualId: string | null;
  departamentoAtualId: string | null;
  status: ProcessStatus;
  /** Quando o processo chegou ao setor onde está. */
  entrouNoSetorEm: string;
  /** Prazo da etapa atual; nulo quando a etapa não tem prazo ativo. */
  prazoDias: number | null;
  prazoLimite: string | null;
  /** Negativo = atrasado. Nulo quando não há prazo. */
  diasParaVencer: number | null;
};

export type Dispatch = {
  id: string;
  tipo: "ANALISE" | "ENCAMINHAMENTO" | "PARECER" | "ORDEM_FORNECIMENTO" | "CANCELAMENTO";
  texto: string | null;
  data: string;
  setorId: string;
  departamentoId: string | null;
  usuarioNome: string;
};

export type ProcessDetail = Process & { despachos: Dispatch[] };
