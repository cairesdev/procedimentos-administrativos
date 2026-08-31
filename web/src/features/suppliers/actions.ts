"use server";

import { revalidatePath } from "next/cache";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import {
  supplierSchema, supplierSelfServiceSchema,
  type SupplierInput, type SupplierSelfServiceInput,
} from "./schemas";

export const createSupplier = async (input: SupplierInput) =>
  runAction(async () => {
    const body = supplierSchema.parse(input);
    await apiRequest(endpoints.suppliers, { method: "POST", body });
    revalidatePath("/processos/fornecedores");
  }, "Fornecedor cadastrado no cadastro global");

// Cadastro global: sem exclusão, e a API registra histórico de cada alteração.
export const updateSupplier = async (id: string, input: SupplierInput) =>
  runAction(async () => {
    const parsed = supplierSchema.parse(input);
    const { documento: _documento, ...body } = parsed;
    await apiRequest(`${endpoints.suppliers}/${id}`, { method: "PATCH", body });
    revalidatePath("/processos/fornecedores");
  }, "Fornecedor atualizado — alteração registrada em histórico");

/**
 * Gera o link do fornecedor. O token volta **uma vez só** — o banco guarda o
 * hash — então a tela precisa mostrá-lo na hora.
 */
export const inviteSupplier = async (
  id: string,
): Promise<{ token: string; expiraEm: string } | { error: string }> => {
  // Fora do `runAction` de propósito: ele devolve só sucesso ou erro, e aqui o
  // token precisa chegar à tela — é a única vez em que ele existe em texto.
  try {
    const dados = await apiRequest<{ token: string; expiraEm: string }>(
      `/fornecedores/${id}/convite`,
      { method: "POST" },
    );
    revalidatePath("/processos/fornecedores");
    return dados;
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : "Não foi possível gerar o link",
    };
  }
};

export const revokeSupplierInvite = async (id: string) =>
  runAction(async () => {
    await apiRequest(`/fornecedores/${id}/convite`, { method: "DELETE" });
    revalidatePath("/processos/fornecedores");
  }, "Link revogado");

/** Envio do próprio fornecedor, sem sessão: a credencial é o token. */
export const saveSupplierSelfService = async (
  token: string,
  input: SupplierSelfServiceInput,
) =>
  runAction(async () => {
    const body = supplierSelfServiceSchema.parse(input);
    await apiRequest(`/publico/fornecedor/${encodeURIComponent(token)}`, {
      method: "PUT",
      body,
    });
  }, "Cadastro atualizado. Obrigado!");
