"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { userSchema, type UserInput } from "./schemas";

export const createUser = async (input: UserInput) =>
  runAction(async () => {
    const { destino, ...user } = userSchema.parse(input);
    const [kind, id] = (destino ?? "").split(":");

    await apiRequest(endpoints.users, {
      method: "POST",
      body: {
        ...user,
        lotacoes: id ? [kind === "unidade" ? { unidadeId: id } : { setorId: id }] : [],
      },
    });
    revalidatePath("/usuarios");
  }, "Usuário cadastrado");
