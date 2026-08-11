import { cookies } from "next/headers";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Profile } from "./types";

export const ASSIGNMENT_COOKIE = "assignment";

export const getProfile = () => apiRequest<Profile>(endpoints.me);

export const getActiveAssignmentId = async (): Promise<string | undefined> =>
  (await cookies()).get(ASSIGNMENT_COOKIE)?.value;
