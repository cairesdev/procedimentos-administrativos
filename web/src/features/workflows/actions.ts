"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { workflowSchema, type WorkflowInput } from "./schemas";

export const saveWorkflow = async (input: WorkflowInput) =>
  runAction(async () => {
    const { tipoProcesso, permiteOverrideUsuario, etapas } = workflowSchema.parse(input);
    await apiRequest(endpoints.workflows(tipoProcesso), {
      method: "PUT",
      body: {
        permiteOverrideUsuario,
        etapas: etapas.map((step, index) => ({
          ...step,
          ordem: index + 1,
          prazoDias: step.prazoAtivo ? (step.prazoDias ?? 0) || undefined : undefined,
        })),
      },
    });
    revalidatePath("/fluxos");
  }, "Fluxo salvo");
