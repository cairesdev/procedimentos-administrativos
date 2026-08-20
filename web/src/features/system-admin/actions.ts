"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { runAction } from "@/shared/api/action-result";
import { clearAdminToken, readAdminToken, writeAdminToken } from "./session";
import {
  adminLoginSchema, firstAdminSchema, letterheadSchema, promoteSchema, resetPasswordSchema,
  systemAdminSchema, tenantSchema, tenantSectorSchema, tenantUnitSchema, tenantUserSchema,
  type AdminLoginInput, type FirstAdminInput, type LetterheadInput, type PromoteInput,
  type ResetPasswordInput, type SystemAdminInput, type TenantInput, type TenantSectorInput,
  type TenantUnitInput, type TenantUserInput,
} from "./schemas";

const withAdminToken = async <T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> => {
  const token = await readAdminToken();
  if (!token) redirect("/admin/login");
  return apiRequest<T>(path, { method, body, token });
};

/** Revalida a lista e o detalhe da prefeitura de uma vez. */
const revalidarPrefeitura = (id: string) => {
  revalidatePath("/admin");
  revalidatePath(`/admin/prefeituras/${id}`);
};

const vazio = (valor?: string) => valor?.trim() || undefined;

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

export const createEntityAdmin = async (id: string, input: FirstAdminInput) =>
  runAction(async () => {
    const body = firstAdminSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${id}/administrador`, "POST", body);
    revalidatePath("/admin");
  }, "Administrador criado");

export const promoteEntityAdmin = async (id: string, input: PromoteInput) =>
  runAction(async () => {
    const { usuarioId } = promoteSchema.parse(input);
    await withAdminToken(
      `/admin/orgaos/${id}/administradores/${usuarioId}/promover`, "POST", {},
    );
    revalidatePath("/admin");
  }, "Usuário promovido a administrador");

// Socorro ao cliente que ficou sem acesso: a senha nova vai para quem pediu,
// por fora do sistema, e a ação fica registrada na auditoria da prefeitura.
export const resetEntityAdminPassword = async (
  id: string,
  usuarioId: string,
  input: ResetPasswordInput,
) =>
  runAction(async () => {
    const body = resetPasswordSchema.parse(input);
    await withAdminToken(
      `/admin/orgaos/${id}/administradores/${usuarioId}/senha`, "POST", body,
    );
    revalidatePath("/admin");
  }, "Senha redefinida");

export const setEntityAdminActive = async (id: string, usuarioId: string, ativo: boolean) =>
  runAction(async () => {
    await withAdminToken(
      `/admin/orgaos/${id}/administradores/${usuarioId}`, "PATCH", { ativo },
    );
    revalidatePath("/admin");
  }, ativo ? "Administrador reativado" : "Administrador inativado");


// ---- Administradores do produto --------------------------------------------

export const createSystemAdmin = async (input: SystemAdminInput) =>
  runAction(async () => {
    const body = systemAdminSchema.parse(input);
    await withAdminToken("/admin/administradores", "POST", body);
    revalidatePath("/admin/administradores");
  }, "Administrador criado");

export const resetSystemAdminPassword = async (id: string, input: ResetPasswordInput) =>
  runAction(async () => {
    const body = resetPasswordSchema.parse(input);
    await withAdminToken(`/admin/administradores/${id}/senha`, "POST", body);
    revalidatePath("/admin/administradores");
  }, "Senha redefinida");

export const setSystemAdminActive = async (id: string, ativo: boolean) =>
  runAction(async () => {
    await withAdminToken(`/admin/administradores/${id}`, "PATCH", { ativo });
    revalidatePath("/admin/administradores");
  }, ativo ? "Administrador reativado" : "Administrador inativado");

// ---- Cadastros da prefeitura pelo painel ------------------------------------

export const createTenantUnit = async (tenantId: string, input: TenantUnitInput) =>
  runAction(async () => {
    const { nome, sigla } = tenantUnitSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${tenantId}/unidades`, "POST", {
      nome, sigla: vazio(sigla),
    });
    revalidarPrefeitura(tenantId);
  }, "Unidade cadastrada");

export const updateTenantUnit = async (
  tenantId: string,
  unitId: string,
  input: TenantUnitInput,
) =>
  runAction(async () => {
    const { nome, sigla } = tenantUnitSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${tenantId}/unidades/${unitId}`, "PATCH", {
      nome, sigla: vazio(sigla) ?? null,
    });
    revalidarPrefeitura(tenantId);
  }, "Unidade atualizada");

export const setTenantUnitActive = async (tenantId: string, unitId: string, ativo: boolean) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${tenantId}/unidades/${unitId}`, "PATCH", { ativo });
    revalidarPrefeitura(tenantId);
  }, ativo ? "Unidade reativada" : "Unidade inativada");

export const deleteTenantUnit = async (tenantId: string, unitId: string) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${tenantId}/unidades/${unitId}`, "DELETE");
    revalidarPrefeitura(tenantId);
  }, "Unidade excluída");

export const createTenantSector = async (tenantId: string, input: TenantSectorInput) =>
  runAction(async () => {
    const body = tenantSectorSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${tenantId}/setores`, "POST", body);
    revalidarPrefeitura(tenantId);
  }, "Setor cadastrado");

export const updateTenantSector = async (
  tenantId: string,
  sectorId: string,
  input: TenantSectorInput,
) =>
  runAction(async () => {
    const body = tenantSectorSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${tenantId}/setores/${sectorId}`, "PATCH", body);
    revalidarPrefeitura(tenantId);
  }, "Setor atualizado");

export const setTenantSectorActive = async (
  tenantId: string,
  sectorId: string,
  ativo: boolean,
) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${tenantId}/setores/${sectorId}`, "PATCH", { ativo });
    revalidarPrefeitura(tenantId);
  }, ativo ? "Setor reativado" : "Setor inativado");

export const deleteTenantSector = async (tenantId: string, sectorId: string) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${tenantId}/setores/${sectorId}`, "DELETE");
    revalidarPrefeitura(tenantId);
  }, "Setor excluído");

export const createTenantUser = async (tenantId: string, input: TenantUserInput) =>
  runAction(async () => {
    const body = tenantUserSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${tenantId}/usuarios`, "POST", { ...body, lotacoes: [] });
    revalidarPrefeitura(tenantId);
  }, "Usuário cadastrado");

export const setTenantUserActive = async (tenantId: string, userId: string, ativo: boolean) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${tenantId}/usuarios/${userId}`, "PATCH", { ativo });
    revalidarPrefeitura(tenantId);
  }, ativo ? "Usuário reativado" : "Usuário inativado");

export const resetTenantUserPassword = async (
  tenantId: string,
  userId: string,
  input: ResetPasswordInput,
) =>
  runAction(async () => {
    const { senha } = resetPasswordSchema.parse(input);
    await withAdminToken(`/admin/orgaos/${tenantId}/usuarios/${userId}`, "PATCH", { senha });
    revalidarPrefeitura(tenantId);
  }, "Senha redefinida");

export const deleteTenantUser = async (tenantId: string, userId: string) =>
  runAction(async () => {
    await withAdminToken(`/admin/orgaos/${tenantId}/usuarios/${userId}`, "DELETE");
    revalidarPrefeitura(tenantId);
  }, "Usuário excluído");
