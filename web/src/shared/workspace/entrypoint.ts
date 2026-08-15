import { redirect } from "next/navigation";
import { getViewer } from "@/shared/auth/guards";
import { findWorkspace, type WorkspaceId } from "@/shared/auth/modules";

// A raiz de um sistema não tem tela própria: manda para a primeira
// que o usuário pode ver.
export const enterWorkspace = async (workspaceId: WorkspaceId): Promise<never> => {
  const viewer = await getViewer();
  const workspace = findWorkspace(workspaceId);

  const first = workspace.sections
    .flatMap((section) => section.links)
    .find((link) => viewer.can(link.permission));

  redirect(first?.href ?? "/");
};
