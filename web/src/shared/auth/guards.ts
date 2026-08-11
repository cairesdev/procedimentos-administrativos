import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";
import type { ModuleName } from "@/features/auth/types";
import { hasModule, hasPermission, type Permission } from "./permissions";

export type Viewer = {
  id: string;
  name: string;
  role: import("@/features/auth/types").Role;
  orgId: string;
  orgName: string;
  modules: ModuleName[];
  can: (permission: Permission) => boolean;
};

export const getViewer = async (): Promise<Viewer> => {
  const session = await auth();
  if (!session) redirect("/login");

  const { user } = session;
  return {
    ...user,
    name: user.name ?? "",
    can: (permission) => hasPermission(user.role, permission),
  };
};

// Página só renderiza se o papel tiver a permissão e o módulo estiver habilitado.
export const requirePermission = async (
  permission: Permission,
  module?: ModuleName,
): Promise<Viewer> => {
  const viewer = await getViewer();
  if (!hasModule(viewer.modules, module)) redirect("/modulo-indisponivel");
  if (!viewer.can(permission)) forbidden();
  return viewer;
};
