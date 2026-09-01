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

/**
 * Informa (ou limpa) a nota fiscal de uma ordem já emitida.
 *
 * Compras e controladoria alcançam: conferir a nota é ato de quem a tem em
 * mãos, e a controladoria é quem confere.
 */
export const informInvoice = async (
  processId: string, ordemId: string, numeroNotaFiscal: string | null,
) =>
  runAction(async () => {
    await apiRequest(`${endpoints.processes}/${processId}/ordens/${ordemId}`, {
      method: "PATCH",
      body: { numeroNotaFiscal },
    });
    revalidatePath(`/processos/fila/${processId}`);
  }, numeroNotaFiscal ? "Nota fiscal registrada" : "Nota fiscal removida");

export const emitSupplyOrder = async (processId: string, input: SupplyOrderInput) =>
  runAction(async () => {
    const body = supplyOrderSchema.parse(input);
    await apiRequest(`${endpoints.processes}/${processId}/ordens`, { method: "POST", body });
    revalidatePath(`/processos/fila/${processId}`);
  }, "Ordem de fornecimento emitida");
