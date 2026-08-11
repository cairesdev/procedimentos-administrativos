import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Process, ProcessDetail } from "./types";

export const listProcesses = (sectorId?: string) =>
  apiRequest<Process[]>(
    sectorId ? `${endpoints.processes}?setor=${sectorId}` : endpoints.processes,
  );

export const findProcess = (id: string) =>
  apiRequest<ProcessDetail>(`${endpoints.processes}/${id}`);
