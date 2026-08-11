"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { bidSchema, type BidInput } from "./schemas";

export const createBid = async (input: BidInput) =>
  runAction(async () => {
    const body = bidSchema.parse(input);
    await apiRequest(endpoints.bids, { method: "POST", body });
    revalidatePath("/licitacoes");
  }, "Licitação cadastrada");
