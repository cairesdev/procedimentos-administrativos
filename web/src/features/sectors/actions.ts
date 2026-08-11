"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  departmentSchema,
  sectorSchema,
  type DepartmentInput,
  type SectorInput,
} from "./schemas";

export const createSector = async (input: SectorInput) =>
  runAction(async () => {
    const body = sectorSchema.parse(input);
    await apiRequest(endpoints.sectors, { method: "POST", body });
    revalidatePath("/setores");
  }, "Setor cadastrado");

export const createDepartment = async (input: DepartmentInput) =>
  runAction(async () => {
    const { setorId, ...body } = departmentSchema.parse(input);
    await apiRequest(endpoints.departments(setorId), { method: "POST", body });
    revalidatePath("/setores");
  }, "Departamento cadastrado");
