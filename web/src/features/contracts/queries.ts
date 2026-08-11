import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Contract, ContractItem } from "./types";

export const listContracts = () => apiRequest<Contract[]>(endpoints.contracts);

export const listContractItems = (contractId: string) =>
  apiRequest<ContractItem[]>(endpoints.contractItems(contractId));
