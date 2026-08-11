"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { supplierSchema, type SupplierInput } from "./schemas";

export const createSupplier = async (input: SupplierInput) =>
  runAction(async () => {
    const body = supplierSchema.parse(input);
    await apiRequest(endpoints.suppliers, { method: "POST", body });
    revalidatePath("/fornecedores");
  }, "Fornecedor cadastrado no cadastro global");

// Cadastro global: sem exclusão, e a API registra histórico de cada alteração.
export const updateSupplier = async (id: string, input: SupplierInput) =>
  runAction(async () => {
    const parsed = supplierSchema.parse(input);
    const { documento: _documento, ...body } = parsed;
    await apiRequest(`${endpoints.suppliers}/${id}`, { method: "PATCH", body });
    revalidatePath("/fornecedores");
  }, "Fornecedor atualizado — alteração registrada em histórico");
