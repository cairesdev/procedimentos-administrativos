import type { ModuleName } from "@/features/auth/types";
import type { Permission } from "./permissions";

export type NavLink = {
  href: string;
  label: string;
  permission: Permission;
  module?: ModuleName;
};

export type NavSection = {
  group: string;
  icon: NavIcon;
  links: NavLink[];
};

export type NavIcon = "inbox" | "fileSignature" | "building" | "shieldCheck";

// Organizado pela etapa do processo, não por tabela do banco.
// Licitação e ata convivem como origens — nenhuma é fixada como caminho único.
export const navigation: NavSection[] = [
  {
    group: "Meu trabalho",
    icon: "inbox",
    links: [
      { href: "/processos", label: "Fila do setor", permission: "processes:read", module: "PROCESSOS" },
      { href: "/solicitacoes", label: "Solicitações", permission: "requests:read", module: "PROCESSOS" },
    ],
  },
  {
    group: "Contratação",
    icon: "fileSignature",
    links: [
      { href: "/licitacoes", label: "Licitações", permission: "bids:read", module: "PROCESSOS" },
      { href: "/atas", label: "Atas de registro", permission: "bids:read", module: "PROCESSOS" },
      { href: "/contratos", label: "Contratos", permission: "contracts:read", module: "PROCESSOS" },
      { href: "/fornecedores", label: "Fornecedores", permission: "suppliers:read" },
    ],
  },
  {
    group: "Organização",
    icon: "building",
    links: [
      { href: "/unidades", label: "Unidades", permission: "units:read" },
      { href: "/setores", label: "Setores", permission: "sectors:read" },
      { href: "/usuarios", label: "Usuários", permission: "users:read" },
    ],
  },
  {
    group: "Controle",
    icon: "shieldCheck",
    links: [
      { href: "/fluxos", label: "Fluxo de processos", permission: "workflows:read", module: "PROCESSOS" },
      { href: "/auditoria", label: "Auditoria", permission: "audit:read" },
    ],
  },
];
