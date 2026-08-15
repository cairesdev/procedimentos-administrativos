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
    revalidatePath("/administracao/usuarios");
  }, "Usuário cadastrado");

export const updateUser = async (id: string, input: UserInput) =>
  runAction(async () => {
    const parsed = userSchema.parse(input);
    const { destino: _destino, username: _username, senha, ...user } = parsed;
    await apiRequest(`${endpoints.users}/${id}`, {
      method: "PATCH",
      body: senha ? { ...user, senha } : user,
    });
    revalidatePath("/administracao/usuarios");
  }, "Usuário atualizado");

export const setUserActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.users}/${id}`, { method: "PATCH", body: { ativo: active } });
    revalidatePath("/administracao/usuarios");
  }, active ? "Usuário reativado" : "Usuário inativado");

export const deleteUser = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.users}/${id}`, { method: "DELETE" });
    revalidatePath("/administracao/usuarios");
  }, "Usuário excluído");
