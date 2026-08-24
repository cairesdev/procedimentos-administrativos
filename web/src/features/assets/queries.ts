import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { withPage, type Page } from "@/shared/api/pagination";
import type {
  Asset,
  AssetCategory,
  AssetIntake,
  AssetLocation,
  AssetTransfer,
  AssetWriteOff,
  Inventory,
  InventoryDetail,
} from "./types";

export const listAssetLocations = () => apiRequest<AssetLocation[]>(endpoints.assetLocations);

export const listAssetCategories = () => apiRequest<AssetCategory[]>(endpoints.assetCategories);

export const listAssetIntakes = (pagina?: string) => {
  const query = withPage(new URLSearchParams(), pagina);
  return apiRequest<Page<AssetIntake>>(
    `${endpoints.assetIntakes}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const listAssets = (
  filters: { local?: string; status?: string; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filters.local) query.set("local", filters.local);
  if (filters.status) query.set("status", filters.status);
  withPage(query, filters.pagina);
  const suffix = query.size > 0 ? `?${query}` : "";
  return apiRequest<Page<Asset>>(`${endpoints.assets}${suffix}`);
};

export const listInventories = () => apiRequest<Inventory[]>(endpoints.inventories);

export const getInventory = (id: string) =>
  apiRequest<InventoryDetail>(`${endpoints.inventories}/${id}`);

export const listAssetTransfers = (
  filters: { status?: string; local?: string; pagina?: string } = {},
) => {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.local) query.set("local", filters.local);
  withPage(query, filters.pagina);
  return apiRequest<Page<AssetTransfer>>(
    `${endpoints.assetTransfers}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const listAssetWriteOffs = (pagina?: string) => {
  const query = withPage(new URLSearchParams(), pagina);
  return apiRequest<Page<AssetWriteOff>>(
    `${endpoints.assetWriteOffs}${query.size > 0 ? `?${query}` : ""}`,
  );
};
