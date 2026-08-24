import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
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

export const listAssetIntakes = () => apiRequest<AssetIntake[]>(endpoints.assetIntakes);

export const listAssets = (filters: { local?: string; status?: string } = {}) => {
  const query = new URLSearchParams();
  if (filters.local) query.set("local", filters.local);
  if (filters.status) query.set("status", filters.status);
  const suffix = query.size > 0 ? `?${query}` : "";
  return apiRequest<Asset[]>(`${endpoints.assets}${suffix}`);
};

export const listInventories = () => apiRequest<Inventory[]>(endpoints.inventories);

export const getInventory = (id: string) =>
  apiRequest<InventoryDetail>(`${endpoints.inventories}/${id}`);

export const listAssetTransfers = (filters: { status?: string; local?: string } = {}) => {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.local) query.set("local", filters.local);
  return apiRequest<AssetTransfer[]>(
    `${endpoints.assetTransfers}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const listAssetWriteOffs = () => apiRequest<AssetWriteOff[]>(endpoints.assetWriteOffs);
