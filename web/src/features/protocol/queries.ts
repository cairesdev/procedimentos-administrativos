import { apiRequest } from "@/shared/api/http-client";
import { withPage, type Page } from "@/shared/api/pagination";
import type { ProtocolSubject, Requirement, ServiceRecord } from "./types";

export const listSubjects = (apenasAtivos = false) =>
  apiRequest<ProtocolSubject[]>(`/protocolo/assuntos${apenasAtivos ? "?ativos=true" : ""}`);

export const listServiceRecords = (
  filtros: { status?: string; assunto?: string; busca?: string; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filtros.status) query.set("status", filtros.status);
  if (filtros.assunto) query.set("assunto", filtros.assunto);
  if (filtros.busca) query.set("busca", filtros.busca);
  withPage(query, filtros.pagina);
  return apiRequest<Page<ServiceRecord>>(
    `/protocolo/atendimentos${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const listRequirements = (processoId: string) =>
  apiRequest<Requirement[]>(`/protocolo/processos/${processoId}/exigencias`);
