import { z } from "zod";
import { ROLES } from "./types";

// destino combina tipo e id ("unidade:<uuid>" | "setor:<uuid>") para virar lotação na action.
export const userSchema = z.object({
  nome: z.string().min(1, "Informe o nome").max(150),
  email: z.email("E-mail inválido"),
  username: z
    .string()
    .regex(/^[a-z0-9._-]{3,40}$/, "Minúsculas, números, ponto, hífen e underline (3 a 40)"),
  senha: z.string().min(8, "Mínimo de 8 caracteres").or(z.literal("")).optional(),
  papelBase: z.enum(ROLES),
  destino: z.string().optional(),
});

export type UserInput = z.infer<typeof userSchema>;
