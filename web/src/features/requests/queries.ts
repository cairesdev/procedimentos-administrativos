import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage, type Page } from "@/shared/api/pagination";
import type { RequestDetail, RequestSummary } from "./types";

export const listRequests = (
  filters: { situacao?: string; unidade?: string; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filters.situacao) query.set("situacao", filters.situacao);
  if (filters.unidade) query.set("unidade", filters.unidade);
  withPage(query, filters.pagina);
  return apiRequest<Page<RequestSummary>>(
    `${endpoints.requests}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const findRequest = (id: string) =>
  apiRequest<RequestDetail>(`${endpoints.requests}/${id}`);
