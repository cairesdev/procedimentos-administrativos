import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { allOf, withPage, POR_PAGINA_MAXIMO, type Page } from "@/shared/api/pagination";
import type { Contract, ContractItem } from "./types";

export const listContracts = (pagina?: string) => {
  const query = withPage(new URLSearchParams(), pagina);
  return apiRequest<Page<Contract>>(
    `${endpoints.contracts}${query.size > 0 ? `?${query}` : ""}`,
  );
};

export const listContractItems = (contractId: string) =>
  apiRequest<ContractItem[]>(endpoints.contractItems(contractId));

/** Todos os contratos, para os `<select>` de montagem de solicitação e ordem. */
export const listAllContracts = () =>
  allOf((pagina) =>
    apiRequest<Page<Contract>>(
      `${endpoints.contracts}?${withPage(new URLSearchParams(), pagina, POR_PAGINA_MAXIMO)}`,
    ),
  );
