"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { bidSchema, type BidInput } from "./schemas";

export const createBid = async (input: BidInput) => {
  let created: { id: string } | undefined;

  const result = await runAction(async () => {
    const { resumo, ...body } = bidSchema.parse(input);
    created = await apiRequest<{ id: string }>(endpoints.bids, {
      method: "POST",
      body: { ...body, resumo: resumo?.trim() || undefined },
    });
    revalidatePath("/licitacoes");
  }, "Licitação cadastrada");

  return created ? { ...result, id: created.id } : result;
};

// Depois que a licitação origina contrato ou ata, a API só aceita resumo e objeto.
export const updateBid = async (id: string, input: BidInput) =>
  runAction(async () => {
    const { resumo, ...body } = bidSchema.parse(input);
    await apiRequest(`${endpoints.bids}/${id}`, {
      method: "PATCH",
      body: { ...body, resumo: resumo?.trim() || null },
    });
    revalidatePath("/licitacoes");
  }, "Licitação atualizada");

export const deleteBid = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.bids}/${id}`, { method: "DELETE" });
    revalidatePath("/licitacoes");
  }, "Licitação excluída");
