import { z } from "zod";

/**
 * O que o módulo de programas aceita receber.
 *
 * As datas são `YYYY-MM-DD` e ficam assim até o banco: elas são dias do
 * calendário, não instantes. Convertê-las em `Date` no caminho faria "2026-09-09"
 * virar 8 de setembro num servidor em Brasília — o mesmo defeito que o
 * domínio já teve e que `DataDoCalendario.ts` existe para impedir.
 */

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
const opcional = (max: number) => z.string().trim().max(max).nullish();

const CONSELHOS = ["CRM", "COREN", "CRFA", "CREFITO", "CRP", "OUTRO"] as const;

export const programaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do programa").max(150),
  sigla: opcional(20),
  descricao: opcional(2000),
  ativo: z.boolean().optional(),
});

export const terapiaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da terapia").max(120),
  conselho: z.enum(CONSELHOS).nullish(),
  ativo: z.boolean().default(true),
});

export const SITUACOES = [
  "EM_INVESTIGACAO", "DIAGNOSTICADO", "ALTA", "TRANSFERIDO", "ABANDONO",
] as const;

export const inscricaoSchema = z.object({
  programaId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  inscritoEm: data.nullish(),
  situacao: z.enum(SITUACOES).default("EM_INVESTIGACAO"),
  diagnosticoEm: data.nullish(),
  // O CID é dado clínico e fica curto de propósito: é código, não diagnóstico
  // por extenso. Texto longo aqui viraria prontuário paralelo.
  cid: opcional(10),
  observacao: opcional(2000),
});

export const situacaoSchema = z.object({
  situacao: z.enum(SITUACOES),
  diagnosticoEm: data.nullish(),
  cid: opcional(10),
  observacao: opcional(2000),
  encerradoEm: data.nullish(),
});

export const indicacaoSchema = z.object({
  terapiaId: z.string().uuid(),
  indicadaEm: data.nullish(),
  // Sessões por semana. Meia sessão existe: "uma a cada quinze dias" é 0,5.
  periodicidadeSemanal: z.number().positive().max(14).nullish(),
});

export const inicioSchema = z.object({ em: data });

export const encerramentoSchema = z.object({
  em: data,
  motivo: z.string().trim().min(1, "Diga por que a terapia foi encerrada").max(200),
});

export const sessaoSchema = z.object({
  data,
  // A falta é registrada, e não apagada: ela explica a diferença entre o que
  // foi combinado e o que a família recebeu.
  compareceu: z.boolean().default(true),
  observacao: opcional(300),
});

export const membroSchema = z.object({
  usuarioId: z.string().uuid(),
  terapiaId: z.string().uuid().nullish(),
  cargaHorariaSemanal: z.number().positive().max(60),
  horasNoPrograma: z.number().positive().max(60),
  localId: z.string().uuid().nullish(),
  unidadeSaudeId: z.string().uuid().nullish(),
  tipoVinculo: z.enum(["EFETIVO", "CONTRATO", "CEDIDO", "TERCEIRIZADO", "OUTRO"]),
});

export const encerrarMembroSchema = z.object({ em: data });

/**
 * A janela do relatório.
 *
 * Vem de quem pede porque o período do ofício varia: "nos últimos 90 dias"
 * numa requisição, "no exercício de 2026" na seguinte. O padrão de 90 dias é o
 * que a tela sugere, e não uma regra.
 */
export const janelaSchema = z.object({
  desde: data,
  ate: data,
}).refine((valores) => valores.desde <= valores.ate, {
  path: ["desde"],
  message: "O início do período não pode ser posterior ao fim",
});
