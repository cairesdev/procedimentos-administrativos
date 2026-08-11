import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Bid } from "./types";

export const listBids = () => apiRequest<Bid[]>(endpoints.bids);
