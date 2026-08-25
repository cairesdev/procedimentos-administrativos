export const REQUESTER_TYPES = [
  { value: "CIDADAO", label: "Cidadão" },
  { value: "FORNECEDOR", label: "Fornecedor" },
  { value: "OUTRO_ORGAO", label: "Outro órgão" },
  { value: "SERVIDOR", label: "Servidor" },
] as const;

export type RequesterType = (typeof REQUESTER_TYPES)[number]["value"];

export type ProtocolSubject = {
  id: string;
  nome: string;
  descricao: string | null;
  /** Setor que resolve; nulo cai na primeira etapa do fluxo. */
  setorId: string | null;
  setorNome: string | null;
  prazoDias: number | null;
  ativo: boolean;
  atendimentos: number;
};

export type Requester = {
  id: string;
  tipo: RequesterType;
  documento: string;
  nome: string;
  contatoEmail: string | null;
  contatoTelefone: string | null;
};

export type ServiceRecord = {
  id: string;
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  status: string;
  dataAbertura: string;
  origemAtendimento: string | null;
  assuntoNome: string | null;
  setorAtualNome: string | null;
  requerenteNome: string;
  requerenteDocumento: string;
};

/** O que a consulta pública devolve — menos que o processo, de propósito. */
export type PublicTracking = {
  numeroProtocolo: string;
  numeroProcessoAdm: string;
  status: string;
  dataAbertura: string;
  dataEncerramento: string | null;
  assuntoNome: string | null;
  descricaoPedido: string | null;
  setorAtualNome: string | null;
  prazoDias: number | null;
  requerenteNome: string;
  orgaoNome: string;
  andamento: { data: string; setorNome: string | null }[];
};
