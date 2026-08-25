import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { allOf, withPage, POR_PAGINA_MAXIMO, type Page } from "@/shared/api/pagination";
import type { Bid, BidDetail } from "./types";

export const listBids = (pagina?: string) => {
  const query = withPage(new URLSearchParams(), pagina);
  return apiRequest<Page<Bid>>(`${endpoints.bids}${query.size > 0 ? `?${query}` : ""}`);
};

/** Todas as licitações, para os formulários que escolhem a origem. */
export const listAllBids = () =>
  allOf((pagina) =>
    apiRequest<Page<Bid>>(
      `${endpoints.bids}?${withPage(new URLSearchParams(), pagina, POR_PAGINA_MAXIMO)}`,
    ),
  );

export const findBid = (id: string) => apiRequest<BidDetail>(`${endpoints.bids}/${id}`);
