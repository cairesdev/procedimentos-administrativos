import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage } from "@/shared/api/pagination";
import type { ProcessDetail, ProcessQueue, SupplyOrder } from "./types";

export const listProcesses = (sectorId?: string, pagina?: string) => {
  const query = new URLSearchParams();
  if (sectorId) query.set("setor", sectorId);
  withPage(query, pagina);
  return apiRequest<ProcessQueue>(
    `${endpoints.processes}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const findProcess = (id: string) =>
  apiRequest<ProcessDetail>(`${endpoints.processes}/${id}`);

/** Ordens já emitidas no processo — só o setor de compras enxerga. */
export const listSupplyOrders = (processId: string) =>
  apiRequest<SupplyOrder[]>(`${endpoints.processes}/${processId}/ordens`);
