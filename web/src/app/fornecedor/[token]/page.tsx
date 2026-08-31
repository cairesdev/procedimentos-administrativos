import { notFound } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { SupplierSelfServiceForm } from "@/features/suppliers/components/SupplierSelfServiceForm";
import { app } from "@/shared/config/app";
import { Alert } from "@/shared/ui/layout";
import { toDate, toDocument } from "@/shared/ui/labels";
import type { SupplierInvitePage } from "@/features/suppliers/types";

type PageProps = { params: Promise<{ token: string }> };

/**
 * O fornecedor corrigindo o próprio cadastro, sem conta no sistema.
 *
 * A credencial é o token do endereço. Quem digita razão social e endereço hoje
 * é o setor de compras, copiando de um papel — e ninguém conhece o dado melhor
 * que o dono dele.
 */
export default async function SupplierInvitePageRoute({ params }: PageProps) {
  const { token } = await params;

  const dados = await apiRequest<SupplierInvitePage>(
    `/publico/fornecedor/${encodeURIComponent(token)}`,
  ).catch((erro) => {
    // Link inválido, expirado e revogado dão o mesmo 404, de propósito: a API
    // não distingue os três para não contar a quem tem um link velho que ele
    // existiu.
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  return (
    <main style={{ maxWidth: "640px", margin: "0 auto", padding: "32px 20px 56px" }}>
      <header style={{ marginBottom: "20px" }}>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--texto_apagado)" }}>
          {app.name}
        </p>
        <h1 style={{ margin: "4px 0 8px", fontSize: "22px" }}>Confirme seus dados</h1>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--texto_suave)" }}>
          A <strong>{dados.orgaoConvidante}</strong> pediu que você conferisse o cadastro da sua
          empresa. O link vale até {toDate(dados.expiraEm)}.
        </p>
      </header>

      <div style={{ marginBottom: "18px" }}>
        <Alert tone="info">
          O CNPJ <strong>{toDocument(dados.documento)}</strong> não pode ser alterado por aqui — ele
          identifica a empresa nos contratos já assinados. Se estiver errado, avise a prefeitura.
        </Alert>
      </div>

      <SupplierSelfServiceForm token={token} dados={dados} />
    </main>
  );
}
