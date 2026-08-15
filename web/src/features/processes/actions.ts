"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  dispatchSchema, opinionSchema, supplyOrderSchema,
  type DispatchInput, type OpinionInput, type SupplyOrderInput,
} from "./schemas";

export const dispatchProcess = async (processId: string, input: DispatchInput) =>
  runAction(async () => {
    const { destinoSetorId, ...body } = dispatchSchema.parse(input);
    await apiRequest(`${endpoints.processes}/${processId}/despachos`, {
      method: "POST",
      body: { ...body, destinoSetorId: destinoSetorId || undefined },
    });
    revalidatePath(`/processos/fila/${processId}`);
    revalidatePath("/processos/fila");
  }, "Despacho registrado");

export const emitOpinion = async (processId: string, input: OpinionInput) =>
  runAction(async () => {
    const { favoravel, ...body } = opinionSchema.parse(input);
    await apiRequest(`${endpoints.processes}/${processId}/parecer`, {
      method: "POST",
      body: { ...body, favoravel: favoravel === "sim" },
    });
    revalidatePath(`/processos/fila/${processId}`);
    revalidatePath("/processos/fila");
  }, "Parecer registrado e processo encerrado");

export const emitSupplyOrder = async (processId: string, input: SupplyOrderInput) =>
  runAction(async () => {
    const body = supplyOrderSchema.parse(input);
    await apiRequest(`${endpoints.processes}/${processId}/ordens`, { method: "POST", body });
    revalidatePath(`/processos/fila/${processId}`);
  }, "Ordem de fornecimento emitida");
