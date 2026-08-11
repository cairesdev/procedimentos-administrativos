import { z } from "zod";

export const loginSchema = z.object({
  identificador: z.string().min(3, "Informe seu usuário ou e-mail"),
  senha: z.string().min(1, "Informe a senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;
