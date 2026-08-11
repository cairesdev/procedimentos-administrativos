import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Supplier } from "./types";

export const listSuppliers = (search?: string) =>
  apiRequest<Supplier[]>(
    search ? `${endpoints.suppliers}?busca=${encodeURIComponent(search)}` : endpoints.suppliers,
  );
