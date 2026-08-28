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
};
