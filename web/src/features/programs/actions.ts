"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { comFiltros } from "@/shared/api/filtros";
import { runAction } from "@/shared/api/action-result";
import { lista } from "@/shared/api/colecao";
import {
  endTherapySchema, enrollmentSchema, indicationSchema, programSchema, sessionSchema,
  startSchema, statusSchema, teamMemberSchema, therapySchema, windowSchema,
  type EndTherapyInput, type EnrollmentInput, type IndicationInput, type ProgramInput,
  type SessionInput, type StartInput, type StatusInput, type TeamMemberInput,
  type TherapyInput, type WindowInput,
} from "./schemas";

const BASE = "/saude/programas";

/** Texto em branco é ausência, e não string vazia. */
const semVazio = (valor?: string) => valor?.trim() || null;

/**
 * Número vindo de `<input type="number">`.
 *
 * `""` viraria `0` num `Number()` distraído. Zero é recusado pela API — carga
 * horária positiva é regra de banco —, e o erro chegaria ao usuário como
 * "violação de restrição" em vez de "preencha o campo".
 */
const semVazioNumero = (valor?: string) => {
  const limpo = valor?.trim();
  if (!limpo) return null;
  const numero = Number(limpo.replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
};

const recarregar = (inscricaoId?: string) => {
  revalidatePath(BASE);
  if (inscricaoId) revalidatePath(`${BASE}/inscritos/${inscricaoId}`);
};

// ---------------------------------------------------------------------------
// Buscas que o formulário faz no navegador

/**
 * As duas buscas de apoio. Não escrevem nada, e por isso não revalidam nada.
 *
 * `apiRequest` só roda no servidor — ele carrega o token da sessão —, então a
 * busca que o formulário precisa fazer no meio do preenchimento vira server
 * action e volta como dado.
 */
export const lookupPeople = async (termo: string) => {
  if (termo.trim().length < 2) return [];
  return apiRequest<unknown>(
    comFiltros(`${BASE}/pessoas`, { termo: termo.trim() }),
  ).then(lista<{ id: string; prontuario: number; nome: string; dataNascimento: string | null }>);
};

export const lookupProfessionals = async () =>
  apiRequest<unknown>(`${BASE}/profissionais`)
    .then(lista<{ id: string; nome: string; papelBase: string; conselho: string | null }>);

// ---------------------------------------------------------------------------
// Catálogo — do administrador

export const saveProgram = async (values: ProgramInput, id?: string) =>
  runAction(async () => {
    const dados = programSchema.parse(values);
    const corpo = {
      nome: dados.nome,
      sigla: semVazio(dados.sigla),
      descricao: semVazio(dados.descricao),
      ...(id ? { ativo: dados.ativo ?? true } : {}),
    };
    const resposta = id
      ? await apiRequest(`${endpoints.programCatalog}/${id}`, { method: "PUT", body: corpo })
      : await apiRequest(endpoints.programCatalog, { method: "POST", body: corpo });
    revalidatePath("/administracao/programas");
    return resposta;
  }, id ? "Programa atualizado" : "Programa criado");

export const saveTherapy = async (
  programaId: string,
  values: TherapyInput,
  terapiaId?: string,
) =>
  runAction(async () => {
    const dados = therapySchema.parse(values);
    const corpo = {
      nome: dados.nome,
      conselho: dados.conselho || null,
      ativo: dados.ativo,
    };
    const resposta = terapiaId
      ? await apiRequest(endpoints.programTherapy(programaId, terapiaId), {
        method: "PUT", body: corpo,
      })
      : await apiRequest(endpoints.programTherapies(programaId), {
        method: "POST", body: corpo,
      });
    revalidatePath("/administracao/programas");
    return resposta;
  }, terapiaId ? "Terapia atualizada" : "Terapia criada");

// ---------------------------------------------------------------------------
// Inscritos

export const enroll = async (values: EnrollmentInput) =>
  runAction(async () => {
    const dados = enrollmentSchema.parse(values);
    const resposta = await apiRequest(endpoints.enrollments, {
      method: "POST",
      body: {
        programaId: dados.programaId,
        pacienteId: dados.pacienteId,
        inscritoEm: semVazio(dados.inscritoEm),
        situacao: dados.situacao,
        diagnosticoEm: semVazio(dados.diagnosticoEm),
        cid: semVazio(dados.cid),
        observacao: semVazio(dados.observacao),
      },
    });
    recarregar();
    return resposta;
  }, "Pessoa inscrita no programa");

export const changeStatus = async (inscricaoId: string, values: StatusInput) =>
  runAction(async () => {
    const dados = statusSchema.parse(values);
    const resposta = await apiRequest(endpoints.enrollmentStatus(inscricaoId), {
      method: "PUT",
      body: {
        situacao: dados.situacao,
        diagnosticoEm: semVazio(dados.diagnosticoEm),
        cid: semVazio(dados.cid),
        observacao: semVazio(dados.observacao),
        encerradoEm: semVazio(dados.encerradoEm),
      },
    });
    recarregar(inscricaoId);
    return resposta;
  }, "Situação atualizada");

// ---------------------------------------------------------------------------
// A fila

export const indicate = async (inscricaoId: string, values: IndicationInput) =>
  runAction(async () => {
    const dados = indicationSchema.parse(values);
    const resposta = await apiRequest(endpoints.indications(inscricaoId), {
      method: "POST",
      body: {
        terapiaId: dados.terapiaId,
        indicadaEm: semVazio(dados.indicadaEm),
        periodicidadeSemanal: semVazioNumero(dados.periodicidadeSemanal),
      },
    });
    recarregar(inscricaoId);
    return resposta;
  }, "Terapia indicada — a pessoa entrou na fila");

/**
 * O registro que fecha a espera.
 *
 * É o ato mais importante do módulo para o relatório: enquanto ele não
 * acontece, a pessoa continua na fila viva e a espera dela cresce sozinha
 * todo dia — inclusive no papel que vai para a Promotoria.
 */
export const startTherapy = async (
  indicacaoId: string,
  inscricaoId: string,
  values: StartInput,
) =>
  runAction(async () => {
    const dados = startSchema.parse(values);
    const resposta = await apiRequest(endpoints.startTherapy(indicacaoId), {
      method: "POST", body: dados,
    });
    recarregar(inscricaoId);
    return resposta;
  }, "Terapia iniciada");

export const endTherapy = async (
  indicacaoId: string,
  inscricaoId: string,
  values: EndTherapyInput,
) =>
  runAction(async () => {
    const dados = endTherapySchema.parse(values);
    const resposta = await apiRequest(endpoints.endTherapy(indicacaoId), {
      method: "POST", body: dados,
    });
    recarregar(inscricaoId);
    return resposta;
  }, "Terapia encerrada");

// ---------------------------------------------------------------------------
// As sessões

export const recordSession = async (
  indicacaoId: string,
  inscricaoId: string,
  values: SessionInput,
) =>
  runAction(async () => {
    const dados = sessionSchema.parse(values);
    const resposta = await apiRequest(endpoints.therapySessions(indicacaoId), {
      method: "POST",
      body: {
        data: dados.data,
        compareceu: dados.compareceu,
        observacao: semVazio(dados.observacao),
      },
    });
    recarregar(inscricaoId);
    return resposta;
  }, "Sessão registrada");

// ---------------------------------------------------------------------------
// A equipe

export const addTeamMember = async (programaId: string, values: TeamMemberInput) =>
  runAction(async () => {
    const dados = teamMemberSchema.parse(values);
    const resposta = await apiRequest(endpoints.programTeam(programaId), {
      method: "POST",
      body: {
        usuarioId: dados.usuarioId,
        terapiaId: semVazio(dados.terapiaId),
        cargaHorariaSemanal: semVazioNumero(dados.cargaHorariaSemanal),
        horasNoPrograma: semVazioNumero(dados.horasNoPrograma),
        unidadeSaudeId: semVazio(dados.unidadeSaudeId),
        tipoVinculo: dados.tipoVinculo,
      },
    });
    revalidatePath(`${BASE}/equipe`);
    return resposta;
  }, "Profissional na equipe");

export const endTeamMember = async (membroId: string, em: string) =>
  runAction(async () => {
    const resposta = await apiRequest(endpoints.endTeamMember(membroId), {
      method: "POST", body: { em },
    });
    revalidatePath(`${BASE}/equipe`);
    return resposta;
  }, "Vínculo encerrado");

// ---------------------------------------------------------------------------
// O recorte da peça oficial

/**
 * Grava a pergunta que a peça vai citar — programa e período —, nunca os
 * números.
 *
 * Eles são reapurados na emissão pelo mesmo caso de uso que a tela usa. É o que
 * impede o papel entregue à Promotoria e a tela da coordenação de dizerem
 * coisas diferentes sobre a mesma fila.
 */
export const saveCut = async (programaId: string, values: WindowInput) =>
  runAction(async () => {
    const dados = windowSchema.parse(values);
    const resposta = await apiRequest(endpoints.programCuts(programaId), {
      method: "POST", body: dados,
    });
    revalidatePath(`${BASE}/relatorio`);
    return resposta;
  }, "Recorte salvo");
