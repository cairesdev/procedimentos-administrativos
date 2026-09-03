import { ZodError } from "zod";
import { ApiError } from "./http-client";
import { idDoCriado } from "./id-do-criado";
import type { ActionResult } from "@/shared/ui/use-resource-form";

type ValidationDetail = { campo: string; motivo: string };

// Converte erro da API em mensagem única para o formulário.
export const runAction = async (
  operation: () => Promise<unknown>,
  success: string,
): Promise<ActionResult> => {
  try {
    const id = idDoCriado(await operation());
    return id ? { success, id } : { success };
  } catch (error) {
    if (error instanceof ApiError) {
      const details = Array.isArray(error.details)
        ? (error.details as ValidationDetail[])
            .map((item) => `${item.campo}: ${item.motivo}`)
            .join("; ")
        : "";
      return { error: details ? `${error.message} — ${details}` : error.message };
    }

    /**
     * A server action revalida com o mesmo schema antes de chamar a API, e o
     * `ZodError` caía no genérico abaixo. "Não foi possível concluir a
     * operação" é o que se diz quando não se sabe o que houve — aqui se sabe,
     * e o campo reprovado é justamente o que o usuário precisa corrigir.
     */
    if (error instanceof ZodError) {
      const primeiro = error.issues[0];
      const campo = primeiro?.path.join(".");
      return {
        error: primeiro
          ? `${campo ? `${campo}: ` : ""}${primeiro.message}`
          : "Dados inválidos",
      };
    }

    return { error: "Não foi possível concluir a operação" };
  }
};
