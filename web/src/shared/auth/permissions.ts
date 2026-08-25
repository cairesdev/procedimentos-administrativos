import type { ModuleName, Role } from "@/features/auth/types";

// A API continua sendo a autoridade final (papel base + overrides em usuario_permissao).
// Esta matriz espelha o papel base para esconder o que o usuário não pode fazer.
export type Permission =
  | "units:read"
  | "units:write"
  | "sectors:read"
  | "sectors:write"
  | "users:read"
  | "users:write"
  | "suppliers:read"
  | "suppliers:write"
  | "bids:read"
  | "bids:write"
  | "contracts:read"
  | "contracts:write"
  | "workflows:read"
  | "workflows:write"
  | "requests:read"
  | "requests:create"
  | "processes:read"
  | "processes:dispatch"
  | "processes:opinion"
  | "processes:order"
  // Trilha de conduta dos servidores: só o ADMIN da prefeitura.
  | "audit:read"
  | "assets:read"
  | "assets:write"
  | "fleet:read"
  | "fleet:write"
  | "trips:create"
  // Emitir peça é ato de quem conduz o processo; editar o modelo é
  // administração da prefeitura — por isso são duas permissões.
  | "documents:issue"
  | "documents:template"
  // Atender no balcão: abrir protocolo em nome de terceiro.
  | "protocol:serve";

const READ_ONLY: Permission[] = [
  "fleet:read",
  "trips:create",
  "units:read",
  "sectors:read",
  "suppliers:read",
  "bids:read",
  "contracts:read",
  "requests:read",
  "processes:read",
];

// Do nível mais amplo ao mais básico.
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "assets:read", "assets:write",
    "fleet:read", "fleet:write", "trips:create",
    "units:read", "units:write",
    "sectors:read", "sectors:write",
    "users:read", "users:write",
    "suppliers:read", "suppliers:write",
    "bids:read", "bids:write",
    "contracts:read", "contracts:write",
    "workflows:read", "workflows:write",
    "requests:read", "requests:create",
    "processes:read", "processes:dispatch", "processes:opinion", "processes:order",
    "audit:read",
    "documents:issue", "documents:template",
    "protocol:serve",
  ],
  GESTOR: [
    ...READ_ONLY,
    "assets:read", "assets:write",
    "fleet:read", "fleet:write", "trips:create",
    "users:read",
    "suppliers:write",
    "bids:write",
    "contracts:write",
    "workflows:read",
    "requests:create",
    "processes:dispatch",
    "documents:issue", "documents:template",
    "protocol:serve",
  ],
  CONTROLADORIA: [...READ_ONLY, "workflows:read", "processes:dispatch", "processes:opinion", "assets:read", "documents:issue"],
  COMPRAS: [...READ_ONLY, "suppliers:write", "contracts:write", "processes:dispatch", "processes:order", "documents:issue"],
  PROTOCOLO: [...READ_ONLY, "processes:dispatch", "documents:issue", "protocol:serve"],
  NUTRICIONISTA: [...READ_ONLY, "requests:create"],
  SERVIDOR: [...READ_ONLY, "requests:create"],
  PATRIMONIO: ["assets:read", "assets:write", "units:read", "processes:read"],
  FROTAS: ["fleet:read", "fleet:write", "trips:create", "units:read"],
};

export const hasPermission = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);

export const hasModule = (modules: ModuleName[], required?: ModuleName): boolean =>
  !required || modules.includes(required);
