import { z } from "zod";
import { ROLES } from "./types";
import { camposDoConselho, comConselho } from "./conselho";

/**
 * O que o formulário de usuário aceita — em duas formas.
 *
 * `destino` combina tipo e id ("unidade:<uuid>" | "setor:<uuid>") para virar
 * lotação na action.
 */
const camposComuns = {
  nome: z.string().min(1, "Informe o nome").max(150),
  email: z.email("E-mail inválido"),
  senha: z.string().min(8, "Mínimo de 8 caracteres").or(z.literal("")).optional(),
  papelBase: z.enum(ROLES),
  destino: z.string().optional(),
  ...camposDoConselho,
};

const REGRA_DO_USERNAME = /^[a-z0-9._-]{3,40}$/;
const AVISO_DO_USERNAME = "Minúsculas, números, ponto, hífen e underline (3 a 40)";

export const userSchema = comConselho(z.object({
  ...camposComuns,
  username: z.string().regex(REGRA_DO_USERNAME, AVISO_DO_USERNAME),
}));

/**
 * A edição não tem nome de usuário — e o schema precisa saber disso.
 *
 * O campo não é desenhado depois da criação (o identificador de login não se
 * troca pela tela), mas `defaultValues` continuava mandando `username: ""`, e
 * o regex reprovava. **Salvar a edição de qualquer usuário estava quebrado**,
 * com o toast reclamando de um campo que a pessoa não via — o pior formato de
 * erro que existe.
 *
 * Dois schemas, e não um `optional()` no de cima: na criação o username é
 * obrigatório de verdade, e afrouxá-lo para consertar a edição deixaria passar
 * cadastro sem identificador de login.
 */
export const userEditSchema = comConselho(z.object({
  ...camposComuns,
  username: z.string().optional(),
}));

export type UserInput = z.infer<typeof userSchema>;
