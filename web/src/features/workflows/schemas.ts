import { z } from "zod";
import { PROCESS_TYPES } from "./types";

const stepSchema = z.object({
  setorId: z.uuid("Selecione o setor"),
  prazoDias: z.coerce.number<number>().int().min(0).optional(),
  prazoAtivo: z.boolean(),
  visibilidadeEstendida: z.boolean(),
});

export const workflowSchema = z.object({
  tipoProcesso: z.enum(PROCESS_TYPES),
  permiteOverrideUsuario: z.boolean(),
  etapas: z.array(stepSchema).min(1, "Defina ao menos uma etapa"),
});

export type WorkflowInput = z.input<typeof workflowSchema>;
