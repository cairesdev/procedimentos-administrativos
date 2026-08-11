"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { unitSchema, type UnitInput } from "./schemas";

export const createUnit = async (input: UnitInput) =>
  runAction(async () => {
    const body = unitSchema.parse(input);
    await apiRequest(endpoints.units, { method: "POST", body });
    revalidatePath("/unidades");
  }, "Unidade cadastrada");

export const updateUnit = async (id: string, input: UnitInput) =>
  runAction(async () => {
    const body = unitSchema.parse(input);
    await apiRequest(`${endpoints.units}/${id}`, { method: "PATCH", body });
    revalidatePath("/unidades");
  }, "Unidade atualizada");

// Ligadas por .bind na tabela — server actions são serializáveis, funções comuns não.
export const setUnitActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.units}/${id}`, { method: "PATCH", body: { ativo: active } });
    revalidatePath("/unidades");
  }, active ? "Unidade reativada" : "Unidade inativada");

export const deleteUnit = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.units}/${id}`, { method: "DELETE" });
    revalidatePath("/unidades");
  }, "Unidade excluída");
