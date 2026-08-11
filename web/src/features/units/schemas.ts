import { z } from "zod";

export const unitSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  sigla: z.string().max(20).optional(),
});

export type UnitInput = z.infer<typeof unitSchema>;
