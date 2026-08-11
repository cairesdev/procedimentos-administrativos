import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { User } from "./types";

export const listUsers = () => apiRequest<User[]>(endpoints.users);
