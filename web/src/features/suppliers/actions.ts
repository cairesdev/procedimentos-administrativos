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
