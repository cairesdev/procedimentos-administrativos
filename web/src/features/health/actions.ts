"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  administrationSchema, amendmentSchema, assessmentSchema, conditionSchema,
  evolutionSchema, examResultSchema, examSchema, healthUnitSchema, openVisitSchema,
  outcomeSchema, patientSchema, prescriptionSchema, procedureSchema, triageSchema,
  type AdministrationInput, type AmendmentInput, type AssessmentInput,
  type ConditionInput, type EvolutionInput, type ExamInput, type ExamResultInput,
  type HealthUnitInput, type OpenVisitInput, type OutcomeInput, type PatientInput,
  type PrescriptionInput, type ProcedureInput, type TriageInput,
} from "./schemas";
import type { CnesEstablishment, CnesMunicipality, PatientSummary } from "./types";

const BASE = "/saude";

/**
 * Buscas que o navegador precisa fazer no meio de um formulário.
 *
 * `apiRequest` só roda no servidor — ele carrega o token da sessão. Quando um
 * componente de tela precisa procurar (o paciente na hora de abrir a ficha, o
 * estabelecimento no CNES), a busca vira server action e volta como dado.
 *
 * Nenhuma delas escreve nada, e por isso não revalidam caminho nenhum.
 */
export const lookupPatients = async (termo: string) => {
  if (termo.trim().length < 2) return [];
  const pagina = await apiRequest<{ itens: PatientSummary[] }>(
    `${endpoints.patients}?termo=${encodeURIComponent(termo.trim())}`,
  );
  return pagina.itens;
};

export const lookupCnesMunicipalities = async (nome: string) => {
  if (nome.trim().length < 3) return [];
  return apiRequest<CnesMunicipality[]>(
    `${endpoints.cnesMunicipalities}?nome=${encodeURIComponent(nome.trim())}`,
  );
};

export const lookupCnesEstablishments = async (codigoMunicipio: string) =>
  apiRequest<CnesEstablishment[]>(endpoints.cnesByMunicipality(codigoMunicipio));

/** Campo de texto vazio é ausência, não string vazia. */
const semVazio = (valor?: string) => valor?.trim() || null;

/**
 * Número vindo de `<input type="number">`.
 *
 * `""` viraria `0` num `Number()` distraído, e zero é um valor plausível de
 * saturação — o campo em branco passaria a dizer que o paciente estava sem
 * oxigênio nenhum.
 */
const semVazioNumero = (valor?: string) => {
  const limpo = valor?.trim();
  if (!limpo) return null;
  const numero = Number(limpo.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
};

const recarregar = (id?: string) => {
  revalidatePath(BASE);
  if (id) revalidatePath(`${BASE}/atendimentos/${id}`);
};

// ---------------------------------------------------------------------------
// Unidades de saúde

export const saveHealthUnit = async (values: HealthUnitInput, id?: string) =>
  runAction(async () => {
    const dados = healthUnitSchema.parse(values);
    const corpo = {
      nome: dados.nome,
      codigoCnes: dados.codigoCnes || null,
      tipoUnidade: semVazioNumero(dados.tipoUnidade),
      endereco: semVazio(dados.endereco),
      telefone: semVazio(dados.telefone),
    };
    const resposta = await apiRequest(
      id ? `${endpoints.healthUnits}/${id}` : endpoints.healthUnits,
      { method: id ? "PUT" : "POST", body: corpo },
    );
    revalidatePath(`${BASE}/unidades`);
    return resposta;
  }, id ? "Unidade atualizada" : "Unidade cadastrada");

// ---------------------------------------------------------------------------
// Pacientes

export const savePatient = async (values: PatientInput, id?: string) =>
  runAction(async () => {
    const dados = patientSchema.parse(values);
    const corpo = {
      nome: dados.nome,
      nomeMae: semVazio(dados.nomeMae),
      dataNascimento: semVazio(dados.dataNascimento),
      sexo: dados.sexo || null,
      cns: semVazio(dados.cns),
      cpf: semVazio(dados.cpf),
      nis: semVazio(dados.nis),
      cnh: semVazio(dados.cnh),
      rg: semVazio(dados.rg),
      endereco: semVazio(dados.endereco),
      cidade: semVazio(dados.cidade),
      uf: semVazio(dados.uf),
      telefone: semVazio(dados.telefone),
      email: semVazio(dados.email),
    };
    const resposta = await apiRequest(
      id ? `${endpoints.patients}/${id}` : endpoints.patients,
      { method: id ? "PUT" : "POST", body: corpo },
    );
    revalidatePath(`${BASE}/pacientes`);
    if (id) revalidatePath(`${BASE}/pacientes/${id}`);
    return resposta;
  }, id ? "Cadastro atualizado" : "Paciente cadastrado");

export const addPatientCondition = async (pacienteId: string, values: ConditionInput) =>
  runAction(async () => {
    const dados = conditionSchema.parse(values);
    const resposta = await apiRequest(endpoints.patientConditions(pacienteId), {
      method: "POST",
      body: { tipo: dados.tipo, descricao: semVazio(dados.descricao) },
    });
    revalidatePath(`${BASE}/pacientes/${pacienteId}`);
    return resposta;
  }, "Registrado");

export const removePatientCondition = async (pacienteId: string, condicaoId: string) =>
  runAction(async () => {
    const resposta = await apiRequest(
      endpoints.patientCondition(pacienteId, condicaoId), { method: "DELETE" },
    );
    revalidatePath(`${BASE}/pacientes/${pacienteId}`);
    return resposta;
  }, "Registro removido");

// ---------------------------------------------------------------------------
// O atendimento e os blocos da ficha

export const openVisit = async (values: OpenVisitInput) =>
  runAction(async () => {
    const dados = openVisitSchema.parse(values);
    const resposta = await apiRequest(endpoints.visits, {
      method: "POST",
      body: {
        unidadeSaudeId: dados.unidadeSaudeId,
        pacienteId: semVazio(dados.pacienteId),
      },
    });
    recarregar();
    return resposta;
  }, "Atendimento aberto");

export const identifyPatient = async (visitaId: string, pacienteId: string) =>
  runAction(async () => {
    const resposta = await apiRequest(
      endpoints.visitBlock(visitaId, "identificar"),
      { method: "POST", body: { pacienteId } },
    );
    recarregar(visitaId);
    return resposta;
  }, "Paciente identificado");

/**
 * A triagem devolve avisos, e a tela precisa mostrá-los.
 *
 * Saturação 71% e temperatura 41 °C entram — são graves e verdadeiras, e são
 * exatamente o paciente que o pronto atendimento precisa registrar depressa.
 * O sistema diz "confere esse número?" e deixa passar.
 */
export const registerTriage = async (visitaId: string, values: TriageInput) =>
  runAction(async () => {
    const dados = triageSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "triagem"), {
      method: "POST",
      body: {
        glicemia: semVazioNumero(dados.glicemia),
        paSistolica: semVazioNumero(dados.paSistolica),
        paDiastolica: semVazioNumero(dados.paDiastolica),
        pulso: semVazioNumero(dados.pulso),
        saturacao: semVazioNumero(dados.saturacao),
        temperatura: semVazioNumero(dados.temperatura),
        queixa: semVazio(dados.queixa),
        conduta: dados.conduta || null,
        prioridade: dados.prioridade,
      },
    });
    recarregar(visitaId);
    return resposta;
  }, "Triagem registrada e assinada");

export const registerAssessment = async (visitaId: string, values: AssessmentInput) =>
  runAction(async () => {
    const dados = assessmentSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "avaliacao"), {
      method: "POST",
      body: dados,
    });
    recarregar(visitaId);
    return resposta;
  }, "Avaliação registrada e assinada");

export const requestExam = async (visitaId: string, values: ExamInput) =>
  runAction(async () => {
    const dados = examSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "exames"), {
      method: "POST",
      body: dados,
    });
    recarregar(visitaId);
    return resposta;
  }, "Exame solicitado");

export const registerExamResult = async (
  visitaId: string, exameId: string, values: ExamResultInput,
) =>
  runAction(async () => {
    const dados = examResultSchema.parse(values);
    const resposta = await apiRequest(endpoints.examResult(visitaId, exameId), {
      method: "PUT",
      body: dados,
    });
    recarregar(visitaId);
    return resposta;
  }, "Resultado registrado");

export const registerPrescription = async (visitaId: string, values: PrescriptionInput) =>
  runAction(async () => {
    const dados = prescriptionSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "prescricoes"), {
      method: "POST",
      body: {
        orientacoes: semVazio(dados.orientacoes),
        itens: dados.itens.map((item) => ({
          ...item,
          observacao: semVazio(item.observacao),
        })),
      },
    });
    recarregar(visitaId);
    return resposta;
  }, "Prescrição registrada e assinada");

export const registerAdministration = async (
  visitaId: string, itemId: string, values: AdministrationInput,
) =>
  runAction(async () => {
    const dados = administrationSchema.parse(values);
    const resposta = await apiRequest(endpoints.administrations(itemId), {
      method: "POST",
      body: {
        horario: new Date(dados.horario).toISOString(),
        observacao: semVazio(dados.observacao),
      },
    });
    recarregar(visitaId);
    return resposta;
  }, "Horário registrado");

export const registerEvolution = async (visitaId: string, values: EvolutionInput) =>
  runAction(async () => {
    const dados = evolutionSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "evolucoes"), {
      method: "POST",
      body: dados,
    });
    recarregar(visitaId);
    return resposta;
  }, "Evolução registrada");

export const registerProcedure = async (visitaId: string, values: ProcedureInput) =>
  runAction(async () => {
    const dados = procedureSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "procedimentos"), {
      method: "POST",
      body: { tipo: dados.tipo, descricao: semVazio(dados.descricao) },
    });
    recarregar(visitaId);
    return resposta;
  }, "Procedimento registrado");

export const registerOutcome = async (visitaId: string, values: OutcomeInput) =>
  runAction(async () => {
    const dados = outcomeSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "desfecho"), {
      method: "POST",
      body: {
        tipo: dados.tipo,
        destino: semVazio(dados.destino),
        horario: new Date(dados.horario).toISOString(),
      },
    });
    recarregar(visitaId);
    return resposta;
  }, "Saída registrada — o atendimento foi encerrado");

/**
 * A rasura datada e rubricada.
 *
 * Corrigir prontuário existe e é bem-vindo; apagar, não. O registro original
 * permanece, a correção entra ao lado com autor e hora próprios, e a ficha
 * impressa mostra as duas.
 */
export const amendRecord = async (visitaId: string, values: AmendmentInput) =>
  runAction(async () => {
    const dados = amendmentSchema.parse(values);
    const resposta = await apiRequest(endpoints.visitBlock(visitaId, "retificacoes"), {
      method: "POST",
      body: dados,
    });
    recarregar(visitaId);
    return resposta;
  }, "Retificação registrada");
