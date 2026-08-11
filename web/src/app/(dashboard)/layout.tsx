import Link from "next/link";
import { auth } from "@/auth";
import { logout } from "@/features/auth/actions";
import { getActiveAssignmentId, getProfile } from "@/features/auth/queries";
import { AssignmentSwitcher } from "@/features/auth/components/AssignmentSwitcher";
import { Button } from "@/shared/ui/button";
import styles from "./dashboard.module.css";

const initials = (name: string): string =>
  name
    .split(" ")
    .filter((part) => part.length > 2)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const menu = [
  {
    group: "Cadastros",
    links: [
      { href: "/unidades", label: "Unidades" },
      { href: "/setores", label: "Setores" },
      { href: "/usuarios", label: "Usuários" },
      { href: "/fornecedores", label: "Fornecedores" },
    ],
  },
  {
    group: "Contratação",
    links: [
      { href: "/licitacoes", label: "Licitações" },
      { href: "/contratos", label: "Contratos" },
    ],
  },
  {
    group: "Configuração",
    links: [{ href: "/fluxos", label: "Fluxo de processos" }],
  },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, profile, activeAssignmentId] = await Promise.all([
    auth(),
    getProfile(),
    getActiveAssignmentId(),
  ]);

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
            <span className={styles.user_name}>{session?.user.name}</span>
            <br />
            <span className={styles.user_role}>{profile.papelBase}</span>
          </span>
          <form action={logout}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.sidebar}>
          {menu.map((section) => (
            <div key={section.group}>
              <p className={styles.sidebar_group}>{section.group.toUpperCase()}</p>
              {section.links.map((link) => (
                <Link key={link.href} href={link.href} className={styles.sidebar_link}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
