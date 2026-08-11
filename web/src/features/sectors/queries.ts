import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Department, Sector } from "./types";

export const listSectors = () => apiRequest<Sector[]>(endpoints.sectors);

export const listDepartments = (sectorId: string) =>
  apiRequest<Department[]>(endpoints.departments(sectorId));

export const findSector = async (sectorId: string) => {
  const sectors = await listSectors();
  return sectors.find((sector) => sector.id === sectorId) ?? null;
};
