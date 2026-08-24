import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { AuditRecord } from "./types";

export type AuditFilters = {
  tipo?: string;
  referencia?: string;
  desde?: string;
  ate?: string;
  limite?: number;
  deslocamento?: number;
};

export const listAuditRecords = (filters: AuditFilters = {}) => {
  const query = new URLSearchParams();
  if (filters.tipo) query.set("tipo", filters.tipo);
  if (filters.referencia) query.set("referencia", filters.referencia);
  if (filters.desde) query.set("desde", filters.desde);
  if (filters.ate) query.set("ate", filters.ate);
  query.set("limite", String(filters.limite ?? 50));
  query.set("deslocamento", String(filters.deslocamento ?? 0));

  return apiRequest<AuditRecord[]>(`${endpoints.audit}?${query}`);
};
