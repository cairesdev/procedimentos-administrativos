import { z } from "zod";

/**
 * O que os formulários da ficha aceitam.
 *
 * Quase tudo opcional, e é o desenho: o pronto atendimento preenche na ordem
 * em que as coisas acontecem, não na ordem em que o formulário pede. Campo
 * obrigatório aqui vira, no balcão, um valor inventado para conseguir salvar.
 *
 * **As faixas dos sinais vitais não estão aqui.** A diferença entre impossível
 * (368 °C) e improvável (41,5 °C) é regra clínica, e mora no domínio da API:
 * o primeiro é recusado, o segundo passa com aviso. Zod só sabe recusar, e
 * recusar 41,5 °C obrigaria o enfermeiro a escrever um valor falso.
 */

const opcional = z.string().trim().optional();

export const patientSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do paciente").max(200),
  nomeMae: opcional,
  dataNascimento: opcional,
  sexo: z.enum(["M", "F", "I"]).optional().or(z.literal("")),
  cns: opcional,
  cpf: opcional,
  nis: opcional,
  cnh: opcional,
  rg: opcional,
  endereco: opcional,
  cidade: opcional,
  uf: opcional,
  telefone: opcional,
  email: opcional,
});
export type PatientInput = z.infer<typeof patientSchema>;

export const conditionSchema = z.object({
  tipo: z.enum(["HAS", "DM", "ALERGIA", "OUTRO"]),
  descricao: opcional,
}).refine(
  (dados) => dados.tipo !== "ALERGIA" || Boolean(dados.descricao?.trim()),
  { path: ["descricao"], message: "Diga a que o paciente é alérgico" },
);
export type ConditionInput = z.infer<typeof conditionSchema>;

export const openVisitSchema = z.object({
  unidadeSaudeId: z.string().uuid("Escolha a unidade"),
  // Vazio é o inconsciente sem documento: a ficha abre, o socorro começa.
  pacienteId: opcional,
});
export type OpenVisitInput = z.infer<typeof openVisitSchema>;

/** Número que veio de `<input type="number">`: string vazia vira nulo. */
const numero = z.string().trim().optional();

export const triageSchema = z.object({
  glicemia: numero,
  paSistolica: numero,
  paDiastolica: numero,
  pulso: numero,
  saturacao: numero,
  temperatura: numero,
  queixa: opcional,
  conduta: z.enum(["URGENCIA", "ENCAMINHADO_UBS", "ENCAMINHADO_INTERNACAO"])
    .optional().or(z.literal("")),
  prioridade: z.boolean().default(false),
});
export type TriageInput = z.infer<typeof triageSchema>;

export const assessmentSchema = z.object({
  queixaClinica: z.string().trim().min(1, "Escreva a avaliação clínica"),
});
export type AssessmentInput = z.infer<typeof assessmentSchema>;

export const examSchema = z.object({
  descricao: z.string().trim().min(1, "Diga qual exame foi solicitado").max(300),
});
export type ExamInput = z.infer<typeof examSchema>;

export const examResultSchema = z.object({
  resultado: z.string().trim().min(1, "Escreva o resultado"),
});
export type ExamResultInput = z.infer<typeof examResultSchema>;

export const prescriptionSchema = z.object({
  orientacoes: opcional,
  itens: z.array(z.object({
    medicamento: z.string().trim().min(1, "Informe o medicamento"),
    dose: z.string().trim().min(1, "Informe a dose"),
    via: z.enum(["ORAL", "IV", "IM", "SC", "TOPICA", "INALATORIA", "RETAL", "OUTRA"]),
    frequencia: z.string().trim().min(1, "Informe a frequência"),
    observacao: opcional,
  })).default([]),
});
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

export const administrationSchema = z.object({
  // O horário é o do relógio de quem deu o remédio. A tela sugere agora e
  // deixa corrigir: a enfermagem registra depois de atender o paciente.
  horario: z.string().min(1, "Informe o horário"),
  observacao: opcional,
});
export type AdministrationInput = z.infer<typeof administrationSchema>;

export const evolutionSchema = z.object({
  tipo: z.enum(["ENFERMAGEM", "MEDICA"]),
  texto: z.string().trim().min(1, "Escreva a evolução"),
});
export type EvolutionInput = z.infer<typeof evolutionSchema>;

export const procedureSchema = z.object({
  tipo: z.enum([
    "URGENCIA_SEM_OBSERVACAO", "URGENCIA_COM_OBSERVACAO", "SUTURA",
    "CURATIVO", "NEBULIZACAO", "CIRURGIA_AMBULATORIAL", "OUTRO",
  ]),
  descricao: opcional,
}).refine(
  (dados) => dados.tipo !== "OUTRO" || Boolean(dados.descricao?.trim()),
  { path: ["descricao"], message: "Diga qual foi o procedimento" },
);
export type ProcedureInput = z.infer<typeof procedureSchema>;

export const outcomeSchema = z.object({
  tipo: z.enum(["ALTA", "ENCAMINHAMENTO", "OBITO"]),
  destino: opcional,
  horario: z.string().min(1, "Informe o horário da saída"),
}).refine(
  (dados) => dados.tipo !== "ENCAMINHAMENTO" || Boolean(dados.destino?.trim()),
  { path: ["destino"], message: "Informe para onde o paciente foi encaminhado" },
);
export type OutcomeInput = z.infer<typeof outcomeSchema>;

export const amendmentSchema = z.object({
  tabelaOrigem: z.enum([
    "triagem", "avaliacao_medica", "exame", "prescricao", "evolucao",
    "procedimento", "desfecho",
  ]),
  registroId: z.string().uuid(),
  texto: z.string().trim().min(1, "Escreva a correção"),
});
export type AmendmentInput = z.infer<typeof amendmentSchema>;

export const healthUnitSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da unidade").max(150),
  codigoCnes: z.string().trim().regex(/^\d{7}$/, "O CNES tem sete dígitos")
    .optional().or(z.literal("")),
  tipoUnidade: opcional,
  endereco: opcional,
  telefone: opcional,
});
export type HealthUnitInput = z.infer<typeof healthUnitSchema>;
