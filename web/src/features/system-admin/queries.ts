import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { readAdminToken } from "./session";
import type { DocumentTemplate, MarkerCatalog } from "@/features/documents/types";
import type {
  EntityAdmin, Letterhead, PromotableUser, SystemAdmin, Tenant, TenantSector, TenantUnit,
  TenantUser,
} from "./types";

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

/** Modelos padrão do produto — valem para toda prefeitura sem versão própria. */
export const listGlobalTemplates = () =>
  adminRequest<DocumentTemplate[]>("/admin/modelos");

export const getGlobalTemplate = async (tipo: string) =>
  (await listGlobalTemplates()).find((modelo) => modelo.tipo === tipo);

export const getGlobalMarkerCatalog = (tipo: string) =>
  adminRequest<MarkerCatalog>(`/admin/modelos/${tipo}/marcadores`);

export const getTenant = async (id: string): Promise<Tenant | undefined> =>
  (await listTenants()).find((tenant) => tenant.id === id);

export const listSystemAdmins = () => adminRequest<SystemAdmin[]>("/admin/administradores");

export const listTenantUnits = (tenantId: string) =>
  adminRequest<TenantUnit[]>(`/admin/orgaos/${tenantId}/unidades`);

export const listTenantSectors = (tenantId: string) =>
  adminRequest<TenantSector[]>(`/admin/orgaos/${tenantId}/setores`);

export const listTenantUsers = (tenantId: string) =>
  adminRequest<TenantUser[]>(`/admin/orgaos/${tenantId}/usuarios`);

export const getLetterhead = (tenantId: string) =>
  adminRequest<Letterhead>(`/admin/orgaos/${tenantId}/timbre`);

export const listEntityAdmins = (tenantId: string) =>
  adminRequest<EntityAdmin[]>(`/admin/orgaos/${tenantId}/administradores`);

export const listPromotableUsers = (tenantId: string) =>
  adminRequest<PromotableUser[]>(`/admin/orgaos/${tenantId}/promoviveis`);
