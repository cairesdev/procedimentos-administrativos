import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { allOf, withPage, POR_PAGINA_MAXIMO, type Page } from "@/shared/api/pagination";
import type { Supplier } from "./types";

export const listSuppliers = (search?: string, pagina?: string) => {
  const query = new URLSearchParams();
  if (search) query.set("busca", search);
  withPage(query, pagina);
  return apiRequest<Page<Supplier>>(
    `${endpoints.suppliers}${query.size > 0 ? `?${query}` : ""}`,
  );
};

/** Todos os fornecedores, para `<select>` e para resolver nome na listagem. */
export const listAllSuppliers = () =>
  allOf((pagina) =>
    apiRequest<Page<Supplier>>(
      `${endpoints.suppliers}?${withPage(new URLSearchParams(), pagina, POR_PAGINA_MAXIMO)}`,
    ),
  );
