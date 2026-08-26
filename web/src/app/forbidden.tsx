import Link from "next/link";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";

export default function Forbidden() {
  return (
    <main style={{ padding: "48px 24px", maxWidth: "560px", margin: "0 auto", display: "grid", gap: "18px", alignContent: "start" }}>
      <PageHeader title="Acesso negado" subtitle="Seu papel não alcança esta área" />
      <Card>
        <Alert tone="info">
          Se você precisa deste acesso, peça ao administrador da prefeitura para ajustar seu papel
          ou conceder a permissão específica.
        </Alert>
        <p style={{ marginTop: "14px", fontSize: "13px" }}>
          <Link href="/" style={{ color: "var(--acao)" }}>
            Voltar ao início
          </Link>
        </p>
      </Card>
    </main>
  );
}
