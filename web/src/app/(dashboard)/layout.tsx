import { logout } from "@/features/auth/actions";
import { getActiveAssignmentId, getProfile } from "@/features/auth/queries";
import { AssignmentSwitcher } from "@/features/auth/components/AssignmentSwitcher";
import { getViewer } from "@/shared/auth/guards";
import { navigation } from "@/shared/auth/navigation";
import { hasModule } from "@/shared/auth/permissions";
import { Button } from "@/shared/ui/button";
import { Sidebar } from "./Sidebar";
import styles from "./dashboard.module.css";

const initials = (name: string): string =>
  name
    .split(" ")
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [viewer, profile, activeAssignmentId] = await Promise.all([
    getViewer(),
    getProfile(),
    getActiveAssignmentId(),
  ]);

  const sections = navigation
    .map((section) => ({
      ...section,
      links: section.links.filter(
        (link) => viewer.can(link.permission) && hasModule(viewer.modules, link.module),
      ),
    }))
    .filter((section) => section.links.length > 0);

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.org}>
          <span className={styles.org_mark} aria-hidden="true">
            {initials(profile.orgaoNome)}
          </span>
          <span>
            <span className={styles.org_name}>{profile.orgaoNome}</span>
            <br />
            <span className={styles.org_system}>Procedimentos administrativos</span>
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
        <Sidebar sections={sections} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
