import { AdminLoginForm } from "@/features/system-admin/components/AdminLoginForm";
import styles from "./admin-login.module.css";

export default function AdminLoginPage() {
  return (
    <main className={styles.screen}>
      <div className={styles.box}>
        <div className={styles.brand}>
          <span className={styles.brand_mark} aria-hidden="true">
            SA
          </span>
          <span>
            <span className={styles.brand_title}>Administração do sistema</span>
            <br />
            <span className={styles.brand_subtitle}>Equipe do produto</span>
          </span>
        </div>

        <p className={styles.intro}>
          Acesso restrito: gerencia as prefeituras atendidas pela plataforma.
        </p>

        <AdminLoginForm />
      </div>
    </main>
  );
}
