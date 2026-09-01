import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { comFiltros } from "@/shared/api/filtros";
import type { Page } from "@/shared/api/pagination";
import type {
  ChecklistDetail, ChecklistSummary, ChecklistTemplate, ChecklistTemplateDetail,
} from "./types";

export const listChecklists = (
  filtros: { alvoTipo?: string; alvoId?: string; emAberto?: boolean; pagina?: string } = {},
) => {
  const { emAberto, ...resto } = filtros;
  return apiRequest<Page<ChecklistSummary>>(
    comFiltros(endpoints.checklists, { ...resto, ...(emAberto ? { emAberto: "1" } : {}) }),
  );
};

/** Os do alvo, sem paginação: o card de um processo mostra todos. */
export const listChecklistsOf = (alvoTipo: string, alvoId: string) =>
  apiRequest<Page<ChecklistSummary>>(
    comFiltros(endpoints.checklists, { alvoTipo, alvoId }),
  ).then((pagina) => pagina.itens);

export const findChecklist = (id: string) =>
  apiRequest<ChecklistDetail>(`${endpoints.checklists}/${id}`);

export const listChecklistTemplates = () =>
  apiRequest<ChecklistTemplate[]>(endpoints.checklistTemplates);

export const findChecklistTemplate = (id: string) =>
  apiRequest<ChecklistTemplateDetail>(`${endpoints.checklistTemplates}/${id}`);

/** O convite aberto deste checklist, se houver — a tela mostra a situação. */
export const findChecklistInvite = (id: string) =>
  apiRequest<{ expiraEm: string; destinatario: string | null; criadoEm: string } | null>(
    `${endpoints.checklists}/${id}/convite`,
  );
