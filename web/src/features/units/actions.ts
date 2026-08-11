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
