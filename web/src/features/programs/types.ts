/**
 * Os programas de cuidado continuado, como a tela os lê.
 *
 * Espelha `ProgramaRepository` na API. Nenhum número derivado vem daqui
 * calculado no cliente: média de espera, mediana e faixa etária são apuradas
 * no domínio da API e chegam prontas, porque a peça que vai para a Promotoria
 * precisa dizer exatamente o mesmo que a tela mostrou.
 */

export const SITUACOES = [
  "EM_INVESTIGACAO", "DIAGNOSTICADO", "ALTA", "TRANSFERIDO", "ABANDONO",
] as const;
export type Situation = (typeof SITUACOES)[number];

export const SITUACAO_ROTULO: Record<Situation, string> = {
  EM_INVESTIGACAO: "Em investigação",
  DIAGNOSTICADO: "Diagnosticado",
  ALTA: "Alta",
  TRANSFERIDO: "Transferido",
  ABANDONO: "Abandono",
};

export const VINCULOS = [
  "EFETIVO", "CONTRATO", "CEDIDO", "TERCEIRIZADO", "OUTRO",
] as const;
export type BondType = (typeof VINCULOS)[number];

export const VINCULO_ROTULO: Record<BondType, string> = {
  EFETIVO: "Efetivo",
  CONTRATO: "Contrato temporário",
  CEDIDO: "Cedido",
  TERCEIRIZADO: "Terceirizado",
  OUTRO: "Outro",
};

export const CONSELHOS = ["CRM", "COREN", "CRFA", "CREFITO", "CRP", "OUTRO"] as const;
export type CouncilType = (typeof CONSELHOS)[number];

export type Therapy = {
  id: string;
  nome: string;
  conselho: CouncilType | null;
  ativo: boolean;
};

export type Program = {
  id: string;
  nome: string;
  sigla: string | null;
  descricao: string | null;
  ativo: boolean;
  terapias: Therapy[];
};

export type EnrolledSummary = {
  id: string;
  pacienteId: string;
  prontuario: number;
  nome: string;
  dataNascimento: string | null;
  situacao: Situation;
  inscritoEm: string;
  diagnosticoEm: string | null;
  cid: string | null;
  terapiasIndicadas: number;
  terapiasIniciadas: number;
};

export type Indication = {
  id: string;
  terapiaId: string;
  terapiaNome: string;
  indicadaEm: string;
  periodicidadeSemanal: number | null;
  iniciadaEm: string | null;
  encerradaEm: string | null;
  motivoEncerramento: string | null;
  sessoesRecentes: number;
  ultimaSessao: string | null;
};

export type EnrolledRecord = {
  inscricao: EnrolledSummary & { observacao: string | null; programaNome: string };
  indicacoes: Indication[];
};

export type Session = {
  id: string;
  data: string;
  profissional: string;
  compareceu: boolean;
  observacao: string | null;
};

export type TeamMember = {
  id: string;
  usuarioId: string;
  nome: string;
  papelBase: string;
  conselho: string | null;
  terapiaId: string | null;
  terapiaNome: string | null;
  cargaHorariaSemanal: number;
  horasNoPrograma: number;
  localNome: string | null;
  unidadeSaudeNome: string | null;
  tipoVinculo: BondType;
  iniciadoEm: string;
  encerradoEm: string | null;
};

/** Uma faixa etária do item 1 do ofício. Faixa vazia continua na lista. */
export type AgeBand = { faixa: string; rotulo: string; quantidade: number };

export type QueueRow = {
  terapiaId: string;
  terapiaNome: string;
  naFila: number;
  esperaMaisAntiga: number;
  mediaNaFila: number;
  iniciados: number;
  mediaAteIniciar: number;
  medianaAteIniciar: number;
  periodicidadeApurada: number;
  periodicidadeCombinada: number | null;
  aderencia: number | null;
};

export type ProgramReport = {
  programa: { id: string; nome: string; sigla: string | null };
  janela: { desde: string; ate: string; dias: number };
  pessoas: {
    porSituacao: { situacao: Situation; quantidade: number }[];
    porFaixa: AgeBand[];
    totalAtivos: number;
  };
  fila: QueueRow[];
  equipe: TeamMember[];
  resumoDaEquipe: {
    profissionais: number;
    horasContratadas: number;
    horasNoPrograma: number;
    exclusivos: number;
    parciais: number;
  };
};

/** O recorte guarda a pergunta — programa e período —, nunca os números. */
export type SavedCut = {
  id: string;
  programaId: string;
  programaNome: string;
  desde: string;
  ate: string;
  criadoEm: string;
};
