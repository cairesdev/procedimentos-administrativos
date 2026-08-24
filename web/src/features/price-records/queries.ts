import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { allOf, withPage, POR_PAGINA_MAXIMO, type Page } from "@/shared/api/pagination";
import type { PriceRecord, PriceRecordItem } from "./types";

export const listPriceRecords = (pagina?: string) => {
  const query = withPage(new URLSearchParams(), pagina);
  return apiRequest<Page<PriceRecord>>(
    `${endpoints.priceRecords}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const listPriceRecordItems = (recordId: string) =>
  apiRequest<PriceRecordItem[]>(endpoints.priceRecordItems(recordId));

/** Todas as atas, para os formulários que escolhem a origem. */
export const listAllPriceRecords = () =>
  allOf((pagina) =>
    apiRequest<Page<PriceRecord>>(
      `${endpoints.priceRecords}?${withPage(new URLSearchParams(), pagina, POR_PAGINA_MAXIMO)}`,
    ),
  );
