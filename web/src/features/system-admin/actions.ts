"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { runAction } from "@/shared/api/action-result";
import { clearAdminToken, readAdminToken, writeAdminToken } from "./session";
import {
  adminLoginSchema, firstAdminSchema, letterheadSchema, tenantSchema,
  type AdminLoginInput, type FirstAdminInput, type LetterheadInput, type TenantInput,
} from "./schemas";

const withAdminToken = async <T>(
  path: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown,
): Promise<T> => {
  const token = await readAdminToken();
  if (!token) redirect("/admin/login");
  return apiRequest<T>(path, { method, body, token });
};

export const adminLogin = async (input: AdminLoginInput) => {
  const credentials = adminLoginSchema.parse(input);

  try {
    const { token } = await apiRequest<{ token: string }>("/admin/login", {
      method: "POST",
      body: credentials,
    });
    await writeAdminToken(token);
  } catch (error) {
    if (error instanceof ApiError) return { error: "E-mail ou senha inválidos" };
    throw error;
  }

  redirect("/admin");
};

export const adminLogout = async () => {
  await clearAdminToken();
  redirect("/admin/login");
};

export const createTenant = async (input: TenantInput) =>
  runAction(async () => {
    const body = tenantSchema.parse(input);
    await withAdminToken("/admin/orgaos", "POST", body);
    revalidatePath("/admin");
  }, "Prefeitura cadastrada");

export const updateTenant = async (id: string, input: TenantInput) =>
  runAction(async () => {
    const { modulos: _modulos, ...body } = tenantSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${id}`, "PATCH", body);
    revalidatePath("/admin");
  }, "Prefeitura atualizada");

export const setTenantActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${id}`, "PATCH", { ativo: active });
    revalidatePath("/admin");
  }, active ? "Prefeitura reativada" : "Prefeitura inativada");

export const setTenantModules = async (id: string, modulos: string[]) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${id}/modulos`, "PUT", { modulos });
    revalidatePath("/admin");
  }, "Módulos atualizados");

export const saveLetterhead = async (id: string, input: LetterheadInput) =>
  runAction(async () => {
    const parsed = letterheadSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${id}/timbre`, "PUT", {
      arquivoLogomarca: parsed.arquivoLogomarca || null,
      cabecalhoTimbre: parsed.cabecalhoTimbre || null,
      rodapeTimbre: parsed.rodapeTimbre || null,
    });
    revalidatePath("/admin");
  }, "Timbre salvo");

export const createFirstAdmin = async (id: string, input: FirstAdminInput) =>
  runAction(async () => {
    const body = firstAdminSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${id}/administrador`, "POST", body);
    revalidatePath("/admin");
  }, "Administrador da prefeitura criado");
