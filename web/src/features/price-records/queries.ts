import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { PriceRecord, PriceRecordItem } from "./types";

export const listPriceRecords = () => apiRequest<PriceRecord[]>(endpoints.priceRecords);

export const listPriceRecordItems = (recordId: string) =>
  apiRequest<PriceRecordItem[]>(endpoints.priceRecordItems(recordId));
