import Link from "next/link";
import {
  Building2, ClipboardCheck, FileSignature, Inbox, MapPin, Package, Route, ShieldCheck,
  Truck, Wrench,
} from "lucide-react";
import { logout } from "@/features/auth/actions";
import { getProfile } from "@/features/auth/queries";
import { getViewer } from "@/shared/auth/guards";
import { workspaces, type NavIcon } from "@/shared/auth/modules";
import { hasModule } from "@/shared/auth/permissions";
import { app } from "@/shared/config/app";
import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/layout";
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
};

// Porta de entrada: cada sistema é um mundo à parte daqui para dentro.
export default async function HubPage() {
  const [viewer, profile] = await Promise.all([getViewer(), getProfile()]);

  const available = workspaces.filter(
    (workspace) =>
      viewer.can(workspace.permission) && hasModule(viewer.modules, workspace.module),
  );

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <p className={styles.org}>
            {app.name} · {profile.orgaoNome}
          </p>
          <h1 className={styles.title}>Olá, {viewer.name.split(" ")[0]}</h1>
          <p className={styles.subtitle}>Escolha o sistema que você quer usar agora</p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary">
            Sair
          </Button>
        </form>
      </header>

      {available.length === 0 ? (
        <Alert tone="info">
          Nenhum sistema liberado para o seu acesso. Fale com o administrador da prefeitura.
        </Alert>
      ) : (
        <div className={styles.grid}>
          {available.map((workspace) => {
            const Icon = icons[workspace.icon];
            return (
              <Link
                key={workspace.id}
                href={workspace.basePath}
                className={styles.card}
                style={{ borderTopColor: workspace.accent }}
              >
                <span
                  className={styles.card_icon}
                  style={{ background: workspace.accentSoft, color: workspace.accent }}
                >
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span className={styles.card_name}>{workspace.name}</span>
                <span className={styles.card_description}>{workspace.description}</span>
              </Link>
            );
          })}
        </div>
      )}

      <p className={styles.footer}>
        {app.shortName} · versão {app.version}
      </p>
    </main>
  );
}
