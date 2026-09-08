import { z } from "zod";
import { CONSELHOS, SITUACOES, VINCULOS } from "./types";

/**
 * O que os formulários do programa aceitam.
 *
 * As datas ficam texto `AAAA-MM-DD` do formulário até o banco. Convertê-las em
 * `Date` no caminho faria "2026-09-09" virar 8 de setembro num servidor em
 * Brasília — o defeito que o domínio da API já teve, e que custou uma criança
 * de três anos e onze meses contada na faixa de quatro a seis.
 */

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
const opcional = z.string().trim().optional();

/**
 * A pessoa que a coordenação cadastra para inscrever.
 *
 * Só o nome é obrigatório, como no balcão do hospital: exigir CNS antes de
 * inscrever não produz dado limpo, produz número inventado para conseguir
 * salvar. O nascimento não é exigido e faz falta — sem ele a pessoa cai na
 * linha "sem data de nascimento" do relatório, que é honesta e feia. A dica no
 * campo diz isso.
 */
export const personSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da pessoa"),
  nomeMae: opcional,
  dataNascimento: data.optional().or(z.literal("")),
  sexo: z.enum(["M", "F", "I"]).optional().or(z.literal("")),
  cns: opcional,
  cpf: opcional,
  telefone: opcional,
});
export type PersonInput = z.infer<typeof personSchema>;

export const enrollmentSchema = z.object({
  programaId: z.string().uuid("Escolha o programa"),
  pacienteId: z.string().uuid("Escolha a pessoa"),
  inscritoEm: data.optional().or(z.literal("")),
  situacao: z.enum(SITUACOES).default("EM_INVESTIGACAO"),
  diagnosticoEm: data.optional().or(z.literal("")),
  cid: opcional,
  observacao: opcional,
});
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

export const statusSchema = z.object({
  situacao: z.enum(SITUACOES),
  diagnosticoEm: data.optional().or(z.literal("")),
  cid: opcional,
  observacao: opcional,
  encerradoEm: data.optional().or(z.literal("")),
});
export type StatusInput = z.infer<typeof statusSchema>;

export const indicationSchema = z.object({
  terapiaId: z.string().uuid("Escolha a terapia"),
  indicadaEm: data.optional().or(z.literal("")),
  // Sessões por semana. Meia sessão existe: "uma a cada quinze dias" é 0,5.
  periodicidadeSemanal: opcional,
});
export type IndicationInput = z.infer<typeof indicationSchema>;

export const startSchema = z.object({ em: data });
export type StartInput = z.infer<typeof startSchema>;

export const endTherapySchema = z.object({
  em: data,
  motivo: z.string().trim().min(1, "Diga por que a terapia foi encerrada"),
});
export type EndTherapyInput = z.infer<typeof endTherapySchema>;

export const sessionSchema = z.object({
  data,
  // A falta entra registrada, e não apagada: ela é a diferença entre o que foi
  // combinado e o que a família recebeu — que é o que o ofício pergunta.
  compareceu: z.boolean().default(true),
  observacao: opcional,
});
export type SessionInput = z.infer<typeof sessionSchema>;

export const teamMemberSchema = z.object({
  usuarioId: z.string().uuid("Escolha o profissional"),
  terapiaId: opcional,
  cargaHorariaSemanal: z.string().trim().min(1, "Informe a carga horária"),
  horasNoPrograma: z.string().trim().min(1, "Informe as horas no programa"),
  unidadeSaudeId: opcional,
  tipoVinculo: z.enum(VINCULOS),
});
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

export const programSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do programa"),
  sigla: opcional,
  descricao: opcional,
  ativo: z.boolean().optional(),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const therapySchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da terapia"),
  conselho: z.enum(CONSELHOS).optional().or(z.literal("")),
  ativo: z.boolean().default(true),
});
export type TherapyInput = z.infer<typeof therapySchema>;

export const windowSchema = z.object({ desde: data, ate: data })
  .refine((valores) => valores.desde <= valores.ate, {
    path: ["desde"],
    message: "O início do período não pode ser posterior ao fim",
  });
export type WindowInput = z.infer<typeof windowSchema>;
