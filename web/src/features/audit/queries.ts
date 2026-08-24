import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage, type Page } from "@/shared/api/pagination";
import type { AuditRecord } from "./types";

export type AuditFilters = {
  tipo?: string;
  referencia?: string;
  desde?: string;
  ate?: string;
  pagina?: string;
};

export const listAuditRecords = (filters: AuditFilters = {}) => {
  const query = new URLSearchParams();
  if (filters.tipo) query.set("tipo", filters.tipo);
  if (filters.referencia) query.set("referencia", filters.referencia);
  if (filters.desde) query.set("desde", filters.desde);
  if (filters.ate) query.set("ate", filters.ate);
  withPage(query, filters.pagina);

  return apiRequest<Page<AuditRecord>>(
    `${endpoints.audit}${query.size > 0 ? `?${query}` : ""}`,
  );
};
