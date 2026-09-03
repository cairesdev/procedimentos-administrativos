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
  // Informar o número da nota fiscal na ordem já emitida. Separado de
  // `processes:order` porque conferir a nota não é emitir a ordem.
  | "orders:invoice"
  // Checklist: ver, montar, cumprir e conferir. Cumprir e conferir são
  // separadas porque ninguém fecha o próprio item.
  | "checklists:read"
  | "checklists:manage"
  | "checklists:fulfill"
  | "checklists:verify"
  // Relatórios gerenciais. Própria porque `contracts:read` autoriza ver *um*
  // contrato; o relatório mostra o conjunto, que é leitura de gestão.
  | "reports:read"
  // Trilha de conduta dos servidores: só o ADMIN da prefeitura.
  | "audit:read"
  | "assets:read"
  | "assets:write"
  | "fleet:read"
  | "fleet:write"
  | "trips:create"
  // Três atos diferentes: ver a peça de um registro que já se alcança,
  // emitir uma nova, e mexer no modelo — este último é administração.
  | "documents:read"
  | "documents:issue"
  | "documents:template"
  // Protocolo é sistema próprio: quem atende no balcão não precisa de
  // licitação, contrato nem solicitação para fazer o trabalho dele.
  | "protocol:read"
  | "protocol:serve"
  | "protocol:manage"
  // Almoxarifado: pedir é da unidade; liberar e dar entrada é de quem
  // administra o estoque. São duas atribuições diferentes e dois papéis.
  | "stock:read"
  | "stock:request"
  | "stock:receive"
  | "stock:manage";

/**
 * Espelho da matriz da API (`domain/shared/Permissoes.ts`), que é a
 * autoridade. Aqui serve só para esconder o que o usuário não pode fazer —
 * a decisão de verdade acontece do outro lado, em `exigirPermissao`.
 *
 * Não existe mais herança comum entre papéis. Havia um `READ_ONLY` que
 * quase todos herdavam, carregando frotas, licitações, contratos e
 * processos: fazia sentido quando o produto era um sistema só, e com cinco
 * módulos virou passe livre — era por ele que a nutricionista enxergava a
 * frota. Um teste na API recusa qualquer divergência entre os dois lados.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "checklists:read",
    "checklists:manage",
    "checklists:fulfill",
    "checklists:verify",
    "assets:read",
    "assets:write",
    "audit:read",
    "bids:read",
    "bids:write",
    "contracts:read",
    "contracts:write",
    "documents:issue",
    "documents:read",
    "documents:template",
    "fleet:read",
    "fleet:write",
    "orders:invoice",
    "processes:dispatch",
    "processes:opinion",
    "processes:order",
    "processes:read",
    "protocol:manage",
    "protocol:read",
    "protocol:serve",
    "reports:read",
    "requests:create",
    "requests:read",
    "sectors:read",
    "sectors:write",
    "stock:manage",
    "stock:read",
    "stock:receive",
    "stock:request",
    "suppliers:read",
    "suppliers:write",
    "trips:create",
    "units:read",
    "units:write",
    "users:read",
    "users:write",
    "workflows:read",
    "workflows:write",
  ],
  GESTOR: [
    "checklists:read",
    "checklists:manage",
    "checklists:fulfill",
    "checklists:verify",
    "assets:read",
    "assets:write",
    "bids:read",
    "bids:write",
    "contracts:read",
    "contracts:write",
    "documents:issue",
    "documents:read",
    "documents:template",
    "fleet:read",
    "fleet:write",
    "orders:invoice",
    "processes:dispatch",
    "processes:order",
    "processes:read",
    "protocol:manage",
    "protocol:read",
    "protocol:serve",
    "reports:read",
    "requests:create",
    "requests:read",
    "sectors:read",
    "sectors:write",
    "stock:manage",
    "stock:read",
    "stock:receive",
    "stock:request",
    "suppliers:read",
    "suppliers:write",
    "trips:create",
    "units:read",
    "units:write",
    "users:read",
    "users:write",
    "workflows:read",
    "workflows:write",
  ],
  COMPRAS: [
    "checklists:read",
    "checklists:manage",
    "checklists:fulfill",
    "checklists:verify",
    "bids:read",
    "bids:write",
    "contracts:read",
    "contracts:write",
    "documents:issue",
    "documents:read",
    "orders:invoice",
    "processes:dispatch",
    "processes:order",
    "processes:read",
    "reports:read",
    "requests:read",
    "sectors:read",
    "suppliers:read",
    "suppliers:write",
    "units:read",
  ],
  CONTROLADORIA: [
    "checklists:read",
    "checklists:verify",
    "assets:read",
    "audit:read",
    "bids:read",
    "contracts:read",
    "documents:issue",
    "documents:read",
    "orders:invoice",
    "processes:dispatch",
    "processes:opinion",
    "processes:read",
    "reports:read",
    "requests:read",
    "sectors:read",
    "suppliers:read",
    "units:read",
    "workflows:read",
  ],
  SERVIDOR: [
    "checklists:read",
    "checklists:fulfill",
    "bids:read",
    "contracts:read",
    "documents:read",
    "processes:read",
    "requests:create",
    "requests:read",
    "sectors:read",
    "suppliers:read",
    "units:read",
  ],
  PROTOCOLO: [
    "checklists:read",
    "checklists:fulfill",
    "documents:issue",
    "documents:read",
    "protocol:read",
    "protocol:serve",
    "sectors:read",
    "units:read",
  ],
  NUTRICIONISTA: [
    "checklists:read",
    "checklists:fulfill",
    "documents:issue",
    "documents:read",
    "sectors:read",
    "stock:manage",
    "stock:read",
    "stock:receive",
    "stock:request",
    "units:read",
  ],
  UNIDADE: [
    "checklists:read",
    "checklists:fulfill",
    "documents:issue",
    "documents:read",
    "sectors:read",
    "stock:read",
    "stock:receive",
    "stock:request",
    "units:read",
  ],
  PATRIMONIO: [
    "checklists:read",
    "checklists:fulfill",
    "assets:read",
    "assets:write",
    "documents:issue",
    "documents:read",
    "sectors:read",
    "suppliers:read",
    "units:read",
  ],
  FROTAS: [
    "checklists:read",
    "checklists:fulfill",
    "documents:issue",
    "documents:read",
    "fleet:read",
    "fleet:write",
    "sectors:read",
    "trips:create",
    "units:read",
  ],
};

export const hasPermission = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);

export const hasModule = (modules: ModuleName[], required?: ModuleName): boolean =>
  !required || modules.includes(required);
