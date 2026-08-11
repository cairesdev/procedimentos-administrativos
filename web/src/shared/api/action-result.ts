import { ApiError } from "./http-client";
import type { ActionResult } from "@/shared/ui/use-resource-form";

type ValidationDetail = { campo: string; motivo: string };

// Converte erro da API em mensagem única para o formulário.
export const runAction = async (
  operation: () => Promise<unknown>,
  success: string,
): Promise<ActionResult> => {
  try {
    await operation();
    return { success };
  } catch (error) {
    if (error instanceof ApiError) {
      const details = Array.isArray(error.details)
        ? (error.details as ValidationDetail[])
            .map((item) => `${item.campo}: ${item.motivo}`)
            .join("; ")
        : "";
      return { error: details ? `${error.message} — ${details}` : error.message };
    }
    return { error: "Não foi possível concluir a operação" };
  }
};
