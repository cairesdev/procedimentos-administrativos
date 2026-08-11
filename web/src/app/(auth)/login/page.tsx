import { LoginForm } from "@/features/auth/components/LoginForm";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams: Promise<{ retorno?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { retorno } = await searchParams;
  const callbackUrl = retorno ?? "/";

  return (
    <main className={styles.screen}>
      <div className={styles.box}>
        <div className={styles.brand}>
          <span className={styles.brand_mark} aria-hidden="true">
            PA
          </span>
          <span>
            <span className={styles.brand_title}>Procedimentos administrativos</span>
            <br />
            <span className={styles.brand_subtitle}>Acesso do servidor</span>
          </span>
        </div>

        <p className={styles.intro}>Entre com seu nome de usuário ou e-mail institucional.</p>

        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
