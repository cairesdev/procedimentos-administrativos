"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { ApiError, apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { comFiltros } from "@/shared/api/filtros";
import { runAction } from "@/shared/api/action-result";
import { lista } from "@/shared/api/colecao";
import {
  endTherapySchema, enrollmentSchema, indicationSchema, personSchema, programSchema,
  sessionSchema, startSchema, statusSchema, teamMemberSchema, therapySchema, windowSchema,
  type EndTherapyInput, type EnrollmentInput, type IndicationInput, type PersonInput,
  type ProgramInput, type SessionInput, type StartInput, type StatusInput,
  type TeamMemberInput, type TherapyInput, type WindowInput,
} from "./schemas";
import type { PersonRecord } from "./types";

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
    comFiltros(endpoints.programPeople, { termo: termo.trim() }),
  ).then(lista<{ id: string; prontuario: number; nome: string; dataNascimento: string | null }>);
};

/**
 * Cadastra a pessoa sem passar pela recepção do hospital.
 *
 * A API atende com o **mesmo** caso de uso do balcão: prontuário vitalício,
 * documentos conferidos no domínio, e a pessoa que já tem cadastro devolvida
 * em vez de duplicada. Cadastrar não abre ficha e não dá acesso a prontuário
 * nenhum.
 *
 * Foge do `runAction` de propósito: a tela precisa do **prontuário** — é o
 * número que a coordenação confere em voz alta — e, no caso do cadastro
 * repetido, precisa do id de quem já existe para selecioná-lo em vez de
 * mandar procurar de novo. `ActionResult` carrega só a mensagem e o id.
 */
export const createPerson = async (
  values: PersonInput,
): Promise<
  | { pessoa: { id: string; prontuario: number; nome: string }; aviso?: string }
  | { error: string }
> => {
  try {
    const dados = personSchema.parse(values);
    const criada = await apiRequest<{ id: string; prontuario: number }>(
      endpoints.programPeople,
      {
        method: "POST",
        body: {
          nome: dados.nome,
          nomeMae: semVazio(dados.nomeMae),
          dataNascimento: semVazio(dados.dataNascimento),
          sexo: dados.sexo || null,
          cns: semVazio(dados.cns),
          cpf: semVazio(dados.cpf),
          telefone: semVazio(dados.telefone),
        },
      },
    );
    recarregar();
    return { pessoa: { id: criada.id, prontuario: criada.prontuario, nome: dados.nome } };
  } catch (erro) {
    /**
     * Cadastro repetido é o caminho feliz, e não um erro.
     *
     * A API devolve 409 com o id e o prontuário de quem já existe — é a mesma
     * pessoa, cadastrada num atendimento antigo. A tela aproveita o cadastro
     * em vez de exigir que a coordenação procure de novo com outra grafia.
     */
    if (erro instanceof ApiError && erro.status === 409) {
      const contexto = erro.details as
        { pacienteId?: string; prontuario?: number; nome?: string } | undefined;
      if (contexto?.pacienteId) {
        return {
          pessoa: {
            id: contexto.pacienteId,
            prontuario: Number(contexto.prontuario ?? 0),
            nome: String(contexto.nome ?? values.nome),
          },
          aviso: erro.message,
        };
      }
    }
    if (erro instanceof ApiError) return { error: erro.message };
    if (erro instanceof ZodError) {
      return { error: erro.issues[0]?.message ?? "Dados inválidos" };
    }
    return { error: "Não foi possível cadastrar a pessoa" };
  }
};

/** O cadastro da pessoa — sem condição clínica, que a rota não devolve. */
export const findPerson = async (id: string) =>
  apiRequest<PersonRecord>(endpoints.programPerson(id));

/**
 * Completar o cadastro — quase sempre a data de nascimento que faltou.
 *
 * O `PUT` grava a pessoa inteira, então o formulário carrega o que existe
 * antes de mandar: enviar só o campo corrigido apagaria o CPF que alguém
 * digitou no mês passado.
 */
export const updatePerson = async (id: string, values: PersonInput & {
  nis?: string; cnh?: string; rg?: string; endereco?: string; cidade?: string;
  uf?: string; email?: string;
}) =>
  runAction(async () => {
    const dados = personSchema.parse(values);
    const resposta = await apiRequest(endpoints.programPerson(id), {
      method: "PUT",
      body: {
        nome: dados.nome,
        nomeMae: semVazio(dados.nomeMae),
        dataNascimento: semVazio(dados.dataNascimento),
        sexo: dados.sexo || null,
        cns: semVazio(dados.cns),
        cpf: semVazio(dados.cpf),
        telefone: semVazio(dados.telefone),
        nis: semVazio(values.nis),
        cnh: semVazio(values.cnh),
        rg: semVazio(values.rg),
        endereco: semVazio(values.endereco),
        cidade: semVazio(values.cidade),
        uf: semVazio(values.uf),
        email: semVazio(values.email),
      },
    });
    recarregar();
    return resposta;
  }, "Cadastro atualizado");

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
    revalidatePath("/saude/cadastros/programas");
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
    revalidatePath("/saude/cadastros/programas");
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
