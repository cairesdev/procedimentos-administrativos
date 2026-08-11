"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { priceRecordSchema, type PriceRecordInput } from "./schemas";

const vazioParaIndefinido = (valor?: string) => (valor?.trim() ? valor.trim() : undefined);

const limparItens = (itens: PriceRecordInput["itens"]) =>
  itens.map((item) => ({
    ...item,
    descricao: vazioParaIndefinido(item.descricao),
    marca: vazioParaIndefinido(item.marca),
  }));

export const createPriceRecord = async (input: PriceRecordInput) =>
  runAction(async () => {
    const body = priceRecordSchema.parse(input);
    await apiRequest(endpoints.priceRecords, {
      method: "POST",
      body: {
        ...body,
        licitacaoId: vazioParaIndefinido(body.licitacaoId),
        itens: limparItens(body.itens),
      },
    });
    revalidatePath("/atas");
  }, "Ata de registro de preços cadastrada");

export const updatePriceRecord = async (id: string, input: PriceRecordInput) =>
  runAction(async () => {
    const body = priceRecordSchema.parse(input);
    await apiRequest(`${endpoints.priceRecords}/${id}`, {
      method: "PATCH",
      body: {
        ...body,
        licitacaoId: vazioParaIndefinido(body.licitacaoId) ?? null,
        itens: limparItens(body.itens),
      },
    });
    revalidatePath("/atas");
  }, "Ata atualizada");

export const deletePriceRecord = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.priceRecords}/${id}`, { method: "DELETE" });
    revalidatePath("/atas");
  }, "Ata excluída");
