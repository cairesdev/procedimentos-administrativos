import { apiRequest, ApiError } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import type { Workflow } from "./types";

export const getWorkflow = async (processType: string): Promise<Workflow | null> => {
  try {
    return await apiRequest<Workflow>(endpoints.workflows(processType));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};
