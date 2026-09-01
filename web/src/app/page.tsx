import Link from "next/link";
import {
  Boxes,
  Building2, ClipboardCheck, FileSignature, Inbox, Lock, MapPin, Package, Route, ShieldCheck,
  Truck, Wrench,
  ListChecks,
} from "lucide-react";
import { logout } from "@/features/auth/actions";
import { getProfile } from "@/features/auth/queries";
import { getViewer } from "@/shared/auth/guards";
import { workspaces, type NavIcon } from "@/shared/auth/modules";
import { hasModule } from "@/shared/auth/permissions";
import { app } from "@/shared/config/app";
import { Button } from "@/shared/ui/button";
import styles from "./hub.module.css";

const icons: Record<NavIcon, typeof Inbox> = {
  inbox: Inbox,
  fileSignature: FileSignature,
  building: Building2,
  shieldCheck: ShieldCheck,
  mapPin: MapPin,
  package: Package,
  clipboardCheck: ClipboardCheck,
  truck: Truck,
  route: Route,
  wrench: Wrench,
  boxes: Boxes,
  listChecks: ListChecks,
};

// Porta de entrada: cada sistema é um mundo à parte daqui para dentro.
export default async function HubPage() {
  const [viewer, profile] = await Promise.all([getViewer(), getProfile()]);

  /**
   * Todos os sistemas aparecem, mesmo os que este usuário não abre. Ver o
   * conjunto completo mostra do que a aplicação é capaz; o card fechado diz
   * por que está fechado, em vez de simplesmente sumir e parecer que não existe.
   */
  const cards = workspaces.map((workspace) => {
    const temModulo = hasModule(viewer.modules, workspace.module);
    const temPermissao = viewer.can(workspace.permission);

    return {
      workspace,
      liberado: temModulo && temPermissao,
      motivo: !temModulo
        ? "Módulo não contratado por esta prefeitura"
        : "Seu perfil não tem acesso a este sistema",
    };
  });

  const liberados = cards.filter((card) => card.liberado).length;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.org}>
            {app.name} · {profile.orgaoNome}
          </p>
          <h1 className={styles.title}>Olá, {viewer.name.split(" ")[0]}</h1>
          <p className={styles.subtitle}>
            {liberados === 0
              ? "Nenhum sistema liberado para o seu acesso. Fale com o administrador da prefeitura."
              : "Escolha o sistema que você quer usar agora"}
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary">
            Sair
          </Button>
        </form>
      </header>

      <div className={styles.grid}>
        {cards.map(({ workspace, liberado, motivo }) => {
          const Icon = icons[workspace.icon];

          const conteudo = (
            <>
              <span
                className={styles.card_icon}
                style={
                  liberado
                    ? { background: workspace.accentSoft, color: workspace.accent }
                    : undefined
                }
              >
                <Icon size={22} aria-hidden="true" />
              </span>
              <span className={styles.card_name}>{workspace.name}</span>
              <span className={styles.card_description}>{workspace.description}</span>
              {liberado ? null : (
                <span className={styles.card_locked}>
                  <Lock size={12} aria-hidden="true" />
                  {motivo}
                </span>
              )}
            </>
          );

          if (!liberado) {
            return (
              <div
                key={workspace.id}
                className={`${styles.card} ${styles.card_disabled}`}
                aria-disabled="true"
                title={motivo}
              >
                {conteudo}
              </div>
            );
          }

          return (
            <Link
              key={workspace.id}
              href={workspace.basePath}
              className={styles.card}
              style={{ borderTopColor: workspace.accent }}
            >
              {conteudo}
            </Link>
          );
        })}
      </div>

      <p className={styles.footer}>
        {app.shortName} · versão {app.version}
      </p>
    </main>
  );
}
