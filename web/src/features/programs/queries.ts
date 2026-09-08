import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { comFiltros } from "@/shared/api/filtros";
import { lista, pagina } from "@/shared/api/colecao";
import type { Page } from "@/shared/api/pagination";
import type {
  EnrolledRecord, EnrolledSummary, Program, ProgramReport, SavedCut, Session, TeamMember,
} from "./types";

export const listPrograms = () =>
  apiRequest<unknown>(endpoints.programCatalog).then(lista<Program>);

export const listEnrolled = (filtros: {
  programa?: string; situacao?: string; termo?: string; pagina?: string;
} = {}) =>
  apiRequest<unknown>(comFiltros(endpoints.enrollments, filtros))
    .then(pagina<EnrolledSummary>) as Promise<Page<EnrolledSummary>>;

export const findEnrolled = (id: string) =>
  apiRequest<EnrolledRecord>(`${endpoints.enrollments}/${id}`);

export const listSessions = (indicacaoId: string) =>
  apiRequest<unknown>(endpoints.therapySessions(indicacaoId)).then(lista<Session>);

export const listTeam = (programaId: string) =>
  apiRequest<unknown>(endpoints.programTeam(programaId)).then(lista<TeamMember>);

/**
 * Os três itens do ofício, apurados agora.
 *
 * Consulta pura: não grava recorte nenhum. O recorte nasce só quando o
 * relatório vai virar papel — e aí ele guarda a pergunta, não a resposta.
 */
export const getProgramReport = (programaId: string, desde: string, ate: string) =>
  apiRequest<ProgramReport>(
    comFiltros(endpoints.programReport(programaId), { desde, ate }),
  );

export const getProgramCut = (id: string) =>
  apiRequest<SavedCut>(endpoints.programCut(id));
