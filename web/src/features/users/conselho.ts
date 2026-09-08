import { z } from "zod";
import type { Role } from "@/features/auth/types";

/**
 * O conselho profissional — o carimbo de quem assina prontuário.
 *
 * Vive num arquivo só porque **duas telas criam usuário**: a da prefeitura
 * (`/administracao/usuarios`) e a do painel do produto
 * (`/admin/prefeituras/[id]`, que cria os primeiros usuários de um município
 * recém-cadastrado). O campo entrou só na primeira, e o médico criado pelo
 * painel nascia sem CRM — sem conseguir fechar bloco nenhum da ficha, e sem
 * ninguém entender por quê.
 *
 * Regra, schema e formatação ficam aqui. As duas telas consomem daqui, e um
 * teste recusa que uma delas volte a esquecer.
 */

/**
 * Papéis que assinam registro clínico.
 *
 * A recepção fica de fora — não tem conselho. O técnico também: o auxiliar de
 * enfermagem nem sempre está inscrito no COREN, e travar aí impediria o
 * registro do horário da medicação, que é o registro que mais precisa ser
 * feito na hora.
 */
export const ROLES_COM_CONSELHO: Role[] = ["SAUDE_ENFERMEIRO", "SAUDE_MEDICO"];

/**
 * Papéis a quem o conselho é **oferecido**, sem travar o cadastro.
 *
 * O terapeuta do programa — fono, TO, psicólogo, fisio — tem registro, e o
 * ofício do Ministério Público pede o de cada profissional. Mas ele não assina
 * bloco de prontuário, então a falta não quebra atendimento nenhum: cobrar na
 * criação atrasaria o cadastro de quem não está com a carteirinha na mão. A
 * coordenação entra pelo mesmo motivo — às vezes é uma psicóloga, às vezes
 * não é profissional de saúde nenhum.
 */
export const ROLES_COM_CONSELHO_OPCIONAL: Role[] = [
  "SAUDE_TERAPEUTA",
  "SAUDE_COORDENACAO",
];

export const assinaProntuario = (papel: string): boolean =>
  (ROLES_COM_CONSELHO as string[]).includes(papel);

/** Mostra os campos: para quem assina, e para quem só informa. */
export const temConselho = (papel: string): boolean =>
  assinaProntuario(papel)
  || (ROLES_COM_CONSELHO_OPCIONAL as string[]).includes(papel);

/**
 * Os conselhos que o sistema conhece — os mesmos do `CHECK` da tabela.
 *
 * `OUTRO` existe porque a lista fechada envelhece: musicoterapeuta e
 * psicopedagogo aparecem em programa de TEA e não têm conselho próprio em
 * todo estado.
 */
export const CONSELHOS = [
  { valor: "CRM", rotulo: "CRM (medicina)" },
  { valor: "COREN", rotulo: "COREN (enfermagem)" },
  { valor: "CRFA", rotulo: "CRFa (fonoaudiologia)" },
  { valor: "CREFITO", rotulo: "CREFITO (fisioterapia e terapia ocupacional)" },
  { valor: "CRP", rotulo: "CRP (psicologia)" },
  { valor: "OUTRO", rotulo: "Outro" },
] as const;

/** Os três campos, como chegam do formulário. */
export const camposDoConselho = {
  conselhoTipo: z
    .enum(["CRM", "COREN", "CRFA", "CREFITO", "CRP", "OUTRO"])
    .or(z.literal(""))
    .optional(),
  conselhoNumero: z.string().trim().max(20).optional(),
  conselhoUf: z.string().trim().max(2).optional(),
};

export type ConselhoInformado = {
  papelBase: string;
  conselhoTipo?: string;
  conselhoNumero?: string;
  conselhoUf?: string;
};

/**
 * As duas regras, na ordem em que o usuário as encontra.
 *
 * A primeira vale para qualquer papel: os três campos andam juntos, porque
 * conselho sem UF não identifica ninguém — CRM 1234 existe em 27 estados. A
 * segunda é a cobrança de médico e enfermeiro, feita **na criação** e não
 * descoberta às três da manhã com o paciente esperando.
 */
export const comConselho = <T extends z.ZodType<ConselhoInformado>>(
  schema: T,
) =>
  schema
    .refine(
      (dados) => {
        const informados = [
          dados.conselhoTipo,
          dados.conselhoNumero,
          dados.conselhoUf,
        ].filter((valor) => valor?.trim());
        return informados.length === 0 || informados.length === 3;
      },
      {
        path: ["conselhoNumero"],
        message: "Informe tipo, número e UF do conselho — os três, ou nenhum",
      },
    )
    .refine(
      (dados) =>
        !assinaProntuario(dados.papelBase) ||
        Boolean(dados.conselhoNumero?.trim()),
      {
        path: ["conselhoNumero"],
        message:
          "Médico e enfermeiro precisam do conselho: é o carimbo que vai na ficha",
      },
    );

/**
 * O conselho no formato que a API entende.
 *
 * Campo em branco vira `null`, e não some do corpo: `null` é "apague" e
 * ausência é "não mexa". Quem trocou de função e deixou de assinar prontuário
 * precisa conseguir limpar o CRM pela tela.
 */
export const conselhoParaApi = (dados: {
  conselhoTipo?: string;
  conselhoNumero?: string;
  conselhoUf?: string;
}) => ({
  conselhoTipo: dados.conselhoTipo?.trim() || null,
  conselhoNumero: dados.conselhoNumero?.trim() || null,
  conselhoUf: dados.conselhoUf?.trim().toUpperCase() || null,
});
