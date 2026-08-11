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
  links: NavLink[];
};

// O menu é filtrado por permissão do papel e por módulo habilitado na prefeitura.
export const navigation: NavSection[] = [
  {
    group: "Processos",
    links: [
      { href: "/processos", label: "Fila do setor", permission: "processes:read", module: "PROCESSOS" },
      { href: "/solicitacoes", label: "Solicitações", permission: "requests:read", module: "PROCESSOS" },
    ],
  },
  {
    group: "Contratação",
    links: [
      { href: "/licitacoes", label: "Licitações", permission: "bids:read", module: "PROCESSOS" },
      { href: "/contratos", label: "Contratos", permission: "contracts:read", module: "PROCESSOS" },
      { href: "/fornecedores", label: "Fornecedores", permission: "suppliers:read" },
    ],
  },
  {
    group: "Cadastros",
    links: [
      { href: "/unidades", label: "Unidades", permission: "units:read" },
      { href: "/setores", label: "Setores", permission: "sectors:read" },
      { href: "/usuarios", label: "Usuários", permission: "users:read" },
    ],
  },
  {
    group: "Controle",
    links: [
      { href: "/fluxos", label: "Fluxo de processos", permission: "workflows:read", module: "PROCESSOS" },
      { href: "/auditoria", label: "Auditoria", permission: "audit:read" },
    ],
  },
];
