"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { requestDraftSchema, type RequestDraftInput } from "./schemas";
import type { CreatedRequest, SentRequest } from "./types";

// Rascunho não reserva saldo nem gera número; o envio faz as duas coisas.
export const createAndSendRequest = async (input: RequestDraftInput) => {
  let sent: SentRequest | undefined;

  const result = await runAction(async () => {
    const body = requestDraftSchema.parse(input);
    const draft = await apiRequest<CreatedRequest>(endpoints.requests, {
      method: "POST",
      body,
    });
    sent = await apiRequest<SentRequest>(`${endpoints.requests}/${draft.id}/enviar`, {
      method: "POST",
      body: {},
    });
    revalidatePath("/processos/solicitacoes");
    revalidatePath("/processos/fila");
  }, "Solicitação enviada");

  return sent ? { success: `Solicitação enviada — protocolo ${sent.protocolo}` } : result;
};

export const saveDraft = async (input: RequestDraftInput) => {
  let draft: CreatedRequest | undefined;

  const result = await runAction(async () => {
    const body = requestDraftSchema.parse(input);
    draft = await apiRequest<CreatedRequest>(endpoints.requests, { method: "POST", body });
    revalidatePath("/processos/solicitacoes");
  }, "Rascunho salvo");

  return draft ? { success: "Rascunho salvo — saldo ainda não reservado" } : result;
};

export const cancelRequest = async (id: string, motivo?: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.requests}/${id}/cancelar`, {
      method: "POST",
      body: { motivo },
    });
    revalidatePath("/processos/solicitacoes");
    revalidatePath("/processos/fila");
  }, "Solicitação cancelada e saldo devolvido");
