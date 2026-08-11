import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { RequestDetail } from "./types";

export const findRequest = (id: string) =>
  apiRequest<RequestDetail>(`${endpoints.requests}/${id}`);
