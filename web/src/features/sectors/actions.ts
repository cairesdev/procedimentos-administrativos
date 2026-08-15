"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  departmentSchema, sectorSchema, type DepartmentInput, type SectorInput,
} from "./schemas";

export const createSector = async (input: SectorInput) =>
  runAction(async () => {
    const body = sectorSchema.parse(input);
    await apiRequest(endpoints.sectors, { method: "POST", body });
    revalidatePath("/administracao/setores");
  }, "Setor cadastrado");

export const updateSector = async (id: string, input: SectorInput) =>
  runAction(async () => {
    const body = sectorSchema.parse(input);
    await apiRequest(`${endpoints.sectors}/${id}`, { method: "PATCH", body });
    revalidatePath("/administracao/setores");
  }, "Setor atualizado");

export const setSectorActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.sectors}/${id}`, { method: "PATCH", body: { ativo: active } });
    revalidatePath("/administracao/setores");
  }, active ? "Setor reativado" : "Setor inativado");

export const deleteSector = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.sectors}/${id}`, { method: "DELETE" });
    revalidatePath("/administracao/setores");
  }, "Setor excluído");

export const createDepartment = async (input: DepartmentInput) =>
  runAction(async () => {
    const { setorId, ...body } = departmentSchema.parse(input);
    await apiRequest(endpoints.departments(setorId), { method: "POST", body });
    revalidatePath("/administracao/setores");
  }, "Departamento cadastrado");

export const updateDepartment = async (id: string, input: DepartmentInput) =>
  runAction(async () => {
    const { setorId, ...body } = departmentSchema.parse(input);
    await apiRequest(`${endpoints.departments(setorId)}/${id}`, { method: "PATCH", body });
    revalidatePath("/administracao/setores");
  }, "Departamento atualizado");

export const deleteDepartment = async (sectorId: string, id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.departments(sectorId)}/${id}`, { method: "DELETE" });
    revalidatePath("/administracao/setores");
  }, "Departamento excluído");
