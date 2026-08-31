import type { Role } from "@/features/auth/types";

export const ROLES = [
  "ADMIN",
  "GESTOR",
  "SERVIDOR",
  "PROTOCOLO",
  "COMPRAS",
  "CONTROLADORIA",
  "NUTRICIONISTA",
  "UNIDADE",
  "PATRIMONIO",
  "FROTAS",
] as const;

/**
 * O que cada papel é, em uma linha, para quem cadastra o usuário escolher sem
 * adivinhar. Antes a tela mostrava só o nome em maiúsculas.
 */
export const ROLE_DESCRIPTIONS: Record<(typeof ROLES)[number], string> = {
  ADMIN: "Administra a prefeitura inteira, inclusive a trilha de auditoria",
  GESTOR: "Secretário ou chefe de gabinete: conduz a contratação e os cadastros",
  SERVIDOR: "Setor administrativo: abre solicitação e acompanha o trâmite",
  PROTOCOLO: "Balcão de atendimento ao cidadão",
  COMPRAS: "Fornecedores, contratos e a ordem de fornecimento",
  CONTROLADORIA: "Lê para dar parecer; não altera cadastro",
  NUTRICIONISTA: "Alimentação escolar: dá entrada e libera para as escolas",
  UNIDADE: "Escola, creche ou posto: pede material e confirma o que recebeu",
  PATRIMONIO: "Bens, tombamento e inventário",
  FROTAS: "Veículos, motoristas e viagens",
};

export type User = {
  id: string;
  nome: string;
  email: string;
  papelBase: Role;
  ativo: boolean;
  /** Onde a pessoa está lotada hoje; nulo quando ninguém a lotou. */
  lotacao: string | null;
  /** O mesmo destino no formato do seletor: `escola:<uuid>`. */
  lotacaoValor: string | null;
};

/**
 * A que módulo cada papel serve.
 *
 * O select trazia dez papéis numa lista plana sob o rótulo "nível de acesso", e
 * escolher entre NUTRICIONISTA e UNIDADE virava adivinhação. Agrupar por módulo
 * responde a pergunta que quem cadastra realmente faz: "esta pessoa trabalha
 * com o quê?".
 */
export const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: "Administração da prefeitura", roles: ["ADMIN", "GESTOR"] },
  { label: "Processos administrativos", roles: ["SERVIDOR", "COMPRAS", "CONTROLADORIA"] },
  { label: "Protocolo", roles: ["PROTOCOLO"] },
  { label: "Almoxarifado e alimentação escolar", roles: ["NUTRICIONISTA", "UNIDADE"] },
  { label: "Patrimônio", roles: ["PATRIMONIO"] },
  { label: "Frotas", roles: ["FROTAS"] },
];

/**
 * Papéis cujo trabalho é de uma escola só.
 *
 * Sem lotação em escola, o usuário da unidade cai na regra "sem lotação, sem
 * trava" e passaria a enxergar a rede inteira — o oposto do que o papel
 * significa. Por isso a tela cobra o vínculo aqui, e só aqui.
 */
export const ROLES_DE_ESCOLA: Role[] = ["UNIDADE"];
