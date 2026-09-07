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
  "SAUDE_RECEPCAO",
  "SAUDE_TECNICO",
  "SAUDE_ENFERMEIRO",
  "SAUDE_MEDICO",
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
  /**
   * Os quatro da ficha hospitalar, descritos pelo ato — não pelo cargo.
   *
   * Quem cadastra o usuário está olhando a escala do plantão, e a pergunta que
   * ele faz é "o que esta pessoa preenche na ficha?".
   */
  SAUDE_RECEPCAO: "Recepção do hospital: identifica o paciente e abre a ficha",
  SAUDE_TECNICO: "Auxiliar ou técnico de enfermagem: carimba o horário da medicação",
  SAUDE_ENFERMEIRO: "Enfermeiro: faz a triagem, evolui e assina a saída do paciente",
  SAUDE_MEDICO: "Médico: avalia, pede exame, prescreve e executa procedimento",
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
  /** O carimbo de quem assina prontuário. Nulo para quem não assina. */
  conselhoTipo?: "CRM" | "COREN" | null;
  conselhoNumero?: string | null;
  conselhoUf?: string | null;
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
  {
    label: "Saúde",
    roles: ["SAUDE_RECEPCAO", "SAUDE_TECNICO", "SAUDE_ENFERMEIRO", "SAUDE_MEDICO"],
  },
];

/**
 * Papéis que assinam registro clínico e, por isso, precisam de conselho.
 *
 * O CRM/COREN é o carimbo: é o que vai impresso na ficha e o que identifica o
 * responsável perante o conselho. Sem ele, o profissional não consegue fechar
 * triagem, avaliação, prescrição, evolução, procedimento nem saída — e
 * descobrir isso no meio do plantão é tarde demais.
 *
 * A recepção fica de fora (não tem conselho) e o técnico também: o auxiliar de
 * enfermagem nem sempre está inscrito, e travar aí impediria o registro do
 * horário da medicação.
 */
export const ROLES_COM_CONSELHO: Role[] = ["SAUDE_ENFERMEIRO", "SAUDE_MEDICO"];

/**
 * Papéis cujo trabalho é de uma escola só.
 *
 * Sem lotação em escola, o usuário da unidade cai na regra "sem lotação, sem
 * trava" e passaria a enxergar a rede inteira — o oposto do que o papel
 * significa. Por isso a tela cobra o vínculo aqui, e só aqui.
 */
export const ROLES_DE_ESCOLA: Role[] = ["UNIDADE"];
