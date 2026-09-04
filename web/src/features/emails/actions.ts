"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { ApiError } from "@/shared/api/http-client";

/**
 * Devolve à fila o que falhou.
 *
 * Só o que falhou: e-mail já entregue não se manda de novo por engano, e a API
 * recusa com a frase certa se alguém tentar.
 */
export const resendEmail = async (
  id: string,
): Promise<{ success: true } | { error: string }> => {
  try {
    await apiRequest(`${endpoints.emails}/${id}/reenviar`, { method: "POST" });
    revalidatePath("/administracao/emails");
    return { success: true };
  } catch (erro) {
    return {
      error: erro instanceof ApiError ? erro.message : "Não foi possível reenviar",
    };
  }
};
