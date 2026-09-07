import { z } from "zod";
import { ROLES, ROLES_COM_CONSELHO } from "./types";

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
  /**
   * O conselho profissional — o carimbo de quem assina prontuário.
   *
   * Os três andam juntos ou nenhum anda: conselho sem UF não identifica
   * ninguém, porque CRM 1234 existe em 27 estados. É a mesma regra que o
   * CHECK da tabela impõe.
   */
  conselhoTipo: z.enum(["CRM", "COREN"]).or(z.literal("")).optional(),
  conselhoNumero: z.string().trim().max(20).optional(),
  conselhoUf: z.string().trim().max(2).optional(),
}).refine((dados) => {
  const informados = [dados.conselhoTipo, dados.conselhoNumero, dados.conselhoUf]
    .filter((valor) => valor?.trim());
  return informados.length === 0 || informados.length === 3;
}, {
  path: ["conselhoNumero"],
  message: "Informe tipo, número e UF do conselho — os três, ou nenhum",
}).refine(
  (dados) => !ROLES_COM_CONSELHO.includes(dados.papelBase)
    || Boolean(dados.conselhoNumero?.trim()),
  {
    path: ["conselhoNumero"],
    /**
     * Cobrado na criação, e não descoberto no plantão.
     *
     * Sem CRM/COREN o médico e o enfermeiro não conseguem fechar bloco nenhum
     * da ficha — e o lugar de resolver isso é aqui, no cadastro, não às três
     * da manhã com o paciente esperando.
     */
    message: "Médico e enfermeiro precisam do conselho: é o carimbo que vai na ficha",
  },
);

export type UserInput = z.infer<typeof userSchema>;
