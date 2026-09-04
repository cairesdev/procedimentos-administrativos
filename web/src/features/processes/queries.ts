import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage } from "@/shared/api/pagination";
import type {
  Attachment, ClosedProcess, ProcessDetail, ProcessQueue, SupplyOrder,
} from "./types";
import type { Page } from "@/shared/api/pagination";

export const listProcesses = (sectorId?: string, pagina?: string) => {
  const query = new URLSearchParams();
  if (sectorId) query.set("setor", sectorId);
  withPage(query, pagina);
  return apiRequest<ProcessQueue>(
    `${endpoints.processes}${query.size > 0 ? `?${query}` : ""}`,
  );
};

/**
 * Encerrados que passaram pelo setor. Sem setor, os do órgão inteiro.
 *
 * O corte é "passou por aqui", não "está aqui": processo encerrado não está em
 * setor nenhum, e quem atuou numa etapa continua tendo de alcançá-lo.
 */
export const listClosedProcesses = (sectorId?: string, pagina?: string) => {
  const query = new URLSearchParams();
  if (sectorId) query.set("setor", sectorId);
  withPage(query, pagina);
  return apiRequest<Page<ClosedProcess>>(
    `${endpoints.processes}/encerrados${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const findProcess = (id: string) =>
  apiRequest<ProcessDetail>(`${endpoints.processes}/${id}`);

/**
 * Ordens já emitidas no processo.
 *
 * Pede `processes:read`, e não `processes:order`: a controladoria precisa
 * conferir a ordem para dar parecer, e antes não a via.
 */
export const listSupplyOrders = (processId: string) =>
  apiRequest<SupplyOrder[]>(`${endpoints.processes}/${processId}/ordens`);

/**
 * Arquivos juntados ao processo.
 *
 * Pede `processes:read` na API: quem alcança o processo alcança os documentos
 * que o sustentam — negar isso a quem dá parecer é pedir parecer sem os autos.
 */
export const listAttachments = (processId: string) =>
  apiRequest<Attachment[]>(`${endpoints.processes}/${processId}/anexos`);
