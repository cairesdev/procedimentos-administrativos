import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Unit } from "./types";

export const listUnits = () => apiRequest<Unit[]>(endpoints.units);
