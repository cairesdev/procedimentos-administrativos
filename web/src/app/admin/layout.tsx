import Link from "next/link";
import { adminLogout } from "@/features/system-admin/actions";
import { Button } from "@/shared/ui/button";
import styles from "./admin.module.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brand_mark} aria-hidden="true">
            SA
          </span>
          <span>
            <span className={styles.brand_title}>Administração do sistema</span>
            <br />
            <span className={styles.brand_subtitle}>Prefeituras atendidas pela plataforma</span>
          </span>
        </div>

        <nav className={styles.nav}>
          <Link href="/admin">Prefeituras</Link>
          <Link href="/admin/administradores">Administradores</Link>
          <Link href="/admin/modelos">Modelos padrão</Link>
        </nav>

        <form action={adminLogout}>
          <Button type="submit" variant="ghost">
            Sair
          </Button>
        </form>
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
