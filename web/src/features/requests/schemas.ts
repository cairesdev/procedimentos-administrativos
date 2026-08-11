import { z } from "zod";

export const requestDraftSchema = z.object({
  unidadeSolicitanteId: z.uuid("Selecione a unidade solicitante"),
  itens: z
    .array(
      z.object({
        itemId: z.uuid(),
        quantidadeSolicitada: z.coerce.number<number>().positive(),
      }),
    )
    .min(1, "Escolha ao menos um item"),
});

export type RequestDraftInput = z.input<typeof requestDraftSchema>;
