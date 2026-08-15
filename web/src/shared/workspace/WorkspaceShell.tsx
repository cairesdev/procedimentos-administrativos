import Link from "next/link";
import { redirect } from "next/navigation";
import { Grid2x2 } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { getActiveAssignmentId, getProfile } from "@/features/auth/queries";
import { AssignmentSwitcher } from "@/features/auth/components/AssignmentSwitcher";
import { getViewer } from "@/shared/auth/guards";
import { findWorkspace, type WorkspaceId } from "@/shared/auth/modules";
import { hasModule } from "@/shared/auth/permissions";
import { Button } from "@/shared/ui/button";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import styles from "./workspace.module.css";

const initials = (name: string): string =>
  name
    .split(" ")
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

// Casca de um sistema: só mostra a navegação dele, nunca a dos outros.
export const WorkspaceShell = async ({
  workspaceId,
  children,
}: {
  workspaceId: WorkspaceId;
  children: React.ReactNode;
}) => {
  const workspace = findWorkspace(workspaceId);
  const [viewer, profile, activeAssignmentId] = await Promise.all([
    getViewer(),
    getProfile(),
    getActiveAssignmentId(),
  ]);

  if (!hasModule(viewer.modules, workspace.module)) redirect("/modulo-indisponivel");

  const sections = workspace.sections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => viewer.can(link.permission)),
    }))
    .filter((section) => section.links.length > 0);

  return (
    <div
      className={styles.app}
      style={
        {
          "--acao": workspace.accent,
          "--acao_suave": workspace.accentSoft,
        } as React.CSSProperties
      }
    >
      <header className={styles.topbar}>
        <div className={styles.identity}>
          <Link href="/" className={styles.switcher} title="Trocar de sistema">
            <Grid2x2 size={17} aria-hidden="true" />
          </Link>

          <span className={styles.org_mark} aria-hidden="true">
            {initials(profile.orgaoNome)}
          </span>
          <span>
            <span className={styles.workspace_name}>{workspace.name}</span>
            <br />
            <span className={styles.org_name}>{profile.orgaoNome}</span>
          </span>
        </div>

        <div className={styles.topbar_right}>
          <AssignmentSwitcher assignments={profile.lotacoes} activeId={activeAssignmentId} />
          <span className={styles.user}>
            <span className={styles.user_name}>{viewer.name}</span>
            <br />
            <span className={styles.user_role}>{viewer.role}</span>
          </span>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </header>

      <div className={styles.body}>
        <WorkspaceSidebar sections={sections} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
};
