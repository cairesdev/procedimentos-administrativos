"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { contractSchema, type ContractInput } from "./schemas";
import type { CreatedContract } from "./types";

export const createContract = async (input: ContractInput) => {
  let created: CreatedContract | undefined;

  const result = await runAction(async () => {
    const body = contractSchema.parse(input);
    created = await apiRequest<CreatedContract>(endpoints.contracts, { method: "POST", body });
    revalidatePath("/contratos");
  }, "Contrato cadastrado");

  return created
    ? { ...result, success: `Contrato cadastrado — protocolo ${created.numeroProtocolo}` }
    : result;
};
