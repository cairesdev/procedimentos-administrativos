import Link from "next/link";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";

export default function UnavailableModulePage() {
  return (
    <main style={{ padding: "48px 24px", maxWidth: "560px", margin: "0 auto" }}>
      <PageHeader
        title="Módulo indisponível"
        subtitle="Esta área não está habilitada para a sua prefeitura"
      />
      <Card>
        <Alert tone="info">
          A habilitação de módulos é feita pela administração do sistema. Fale com o responsável
          para liberar o acesso.
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
