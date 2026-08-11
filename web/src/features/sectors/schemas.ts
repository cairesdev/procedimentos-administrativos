import { z } from "zod";
import { SECTOR_TYPES } from "./types";

export const sectorSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  tipo: z.enum(SECTOR_TYPES),
});

export const departmentSchema = z.object({
  setorId: z.uuid("Selecione o setor"),
  nome: z.string().min(1, "Informe o nome").max(150),
  categoriaAtendimento: z.string().max(100).optional(),
});

export type SectorInput = z.infer<typeof sectorSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
