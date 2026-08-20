import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { readAdminToken } from "./session";
import type { EntityAdmin, Letterhead, PromotableUser, Tenant } from "./types";

// O painel do produto usa token próprio, com escopo separado do dos servidores.
const adminRequest = async <T>(path: string): Promise<T> => {
  const token = await readAdminToken();
  if (!token) redirect("/admin/login");

  try {
    return await apiRequest<T>(path, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/admin/login");
    throw error;
  }
};

export const listTenants = () => adminRequest<Tenant[]>("/admin/orgaos");

export const getLetterhead = (tenantId: string) =>
  adminRequest<Letterhead>(`/admin/orgaos/${tenantId}/timbre`);

export const listEntityAdmins = (tenantId: string) =>
  adminRequest<EntityAdmin[]>(`/admin/orgaos/${tenantId}/administradores`);

export const listPromotableUsers = (tenantId: string) =>
  adminRequest<PromotableUser[]>(`/admin/orgaos/${tenantId}/promoviveis`);
