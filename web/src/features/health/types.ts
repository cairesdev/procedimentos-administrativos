/**
 * A ficha de atendimento, como a tela a lê.
 *
 * Espelha `AtendimentoSaudeRepository` na API. O que muda é o vocabulário do
 * arquivo, não a forma: um teste estrutural recusa divergência entre os dois
 * lados quando ela existe em rota.
 */

export type HealthUnit = {
  id: string;
  nome: string;
  codigoCnes: string | null;
  tipoUnidade: number | null;
  endereco: string | null;
  telefone: string | null;
  cnesConsultadoEm: string | null;
  unidadeId: string | null;
  ativo: boolean;
};

export type CnesMunicipality = { codigo: string; nome: string; uf: string };

export type CnesEstablishment = {
  codigoCnes: string;
  nome: string;
  tipoUnidade: number | null;
  tipoUnidadeDescricao: string | null;
  endereco: string | null;
  telefone: string | null;
  municipio: number | null;
};

export type PatientCondition = {
  id: string;
  tipo: "HAS" | "DM" | "ALERGIA" | "OUTRO";
  descricao: string | null;
  registradoPor: string | null;
  registradoEm: string;
};

export type PatientSummary = {
  id: string;
  prontuario: number;
  nome: string;
  nomeMae: string | null;
  dataNascimento: string | null;
  cns: string | null;
  cpf: string | null;
  telefone: string | null;
};

export type Patient = PatientSummary & {
  sexo: string | null;
  nis: string | null;
  cnh: string | null;
  rg: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  condicoes: PatientCondition[];
};

export type VisitStatus = "EM_ANDAMENTO" | "ENCERRADO";

export type VisitSummary = {
  id: string;
  numero: string;
  status: VisitStatus;
  pacienteId: string | null;
  abertoEm: string;
  pacienteNome: string | null;
  prontuario: number | null;
  unidadeSaudeNome: string;
  prioridade: boolean | null;
  temTriagem: boolean;
  temAvaliacao: boolean;
  desfechoTipo: string | null;
};

export type Triage = {
  glicemia: number | null;
  paSistolica: number | null;
  paDiastolica: number | null;
  pulso: number | null;
  saturacao: number | null;
  temperatura: number | null;
  queixa: string | null;
  conduta: string | null;
  prioridade: boolean;
  fechadoPor: string | null;
  fechadoEm: string | null;
};

export type Exam = {
  id: string;
  descricao: string;
  resultado: string | null;
  solicitadoPor: string;
  solicitadoEm: string;
  resultadoPor: string | null;
  resultadoEm: string | null;
};

export type PrescribedItem = {
  id: string;
  medicamento: string;
  dose: string;
  via: string;
  frequencia: string;
  observacao: string | null;
  administracoes: {
    id: string; horario: string; executadoPor: string; observacao: string | null;
  }[];
};

export type Prescription = {
  id: string;
  orientacoes: string | null;
  fechadoPor: string | null;
  fechadoEm: string | null;
  itens: PrescribedItem[];
};

export type VisitRecord = {
  atendimento: VisitSummary & { unidadeSaudeId: string; abertoPor: string };
  paciente: {
    id: string; prontuario: number; nome: string; nomeMae: string | null;
    dataNascimento: string | null; cns: string | null; endereco: string | null;
    cidade: string | null; uf: string | null; telefone: string | null; email: string | null;
    condicoes: { tipo: string; descricao: string | null }[];
  } | null;
  triagem: Triage | null;
  avaliacao: { queixaClinica: string; fechadoPor: string | null; fechadoEm: string | null } | null;
  exames: Exam[];
  prescricoes: Prescription[];
  evolucoes: { id: string; tipo: string; texto: string; autor: string; fechadoEm: string }[];
  procedimentos: {
    id: string; tipo: string; descricao: string | null; autor: string; executadoEm: string;
  }[];
  desfecho: {
    tipo: string; destino: string | null; horario: string;
    fechadoPor: string; fechadoEm: string;
  } | null;
  retificacoes: {
    id: string; tabelaOrigem: string; registroId: string; texto: string;
    autor: string; criadoEm: string;
  }[];
};

/** Os rótulos que o papel usa. A tela fala a língua do formulário impresso. */
export const CONDUCT_LABELS: Record<string, string> = {
  URGENCIA: "Atendimento de urgência",
  ENCAMINHADO_UBS: "Encaminhado para UBS",
  ENCAMINHADO_INTERNACAO: "Encaminhado para internação",
};

export const PROCEDURE_LABELS: Record<string, string> = {
  URGENCIA_SEM_OBSERVACAO: "Atendimento de urgência s/ observação",
  URGENCIA_COM_OBSERVACAO: "Atendimento de urgência c/ observação",
  SUTURA: "Sutura",
  CURATIVO: "Curativo",
  NEBULIZACAO: "Nebulização",
  CIRURGIA_AMBULATORIAL: "Pequena cirurgia ambulatorial",
  OUTRO: "Outros",
};

export const ROUTE_LABELS: Record<string, string> = {
  ORAL: "Oral",
  IV: "Intravenosa",
  IM: "Intramuscular",
  SC: "Subcutânea",
  TOPICA: "Tópica",
  INALATORIA: "Inalatória",
  RETAL: "Retal",
  OUTRA: "Outra",
};

export const OUTCOME_LABELS: Record<string, string> = {
  ALTA: "Alta",
  ENCAMINHAMENTO: "Encaminhamento",
  OBITO: "Óbito",
};

export const CONDITION_LABELS: Record<string, string> = {
  HAS: "HAS (hipertensão)",
  DM: "DM (diabetes)",
  ALERGIA: "Alergia",
  OUTRO: "Outros",
};
