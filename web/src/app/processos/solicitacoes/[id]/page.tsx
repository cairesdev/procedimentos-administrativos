import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { findRequest } from "@/features/requests/queries";
import { RequestDetailView } from "@/features/requests/components/RequestDetailView";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";

type RequestPageProps = { params: Promise<{ id: string }> };

export default async function RequestDetailPage({ params }: RequestPageProps) {
  const viewer = await requirePermission("requests:read", "PROCESSOS");
  const { id } = await params;

  const request = await findRequest(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  // "Imprimir" é a folha timbrada direta; o comprovante é peça registrada,
  // com código de conferência. O modelo existia desde a 0016 e não tinha
  // onde ser pedido.
  const [modelos, emitidos] = await Promise.all([
    listTemplates("PROCESSOS").catch(() => []),
    listDocumentsFor(request.id).catch(() => []),
  ]);

  return (
    <>
      <Link href="/processos/solicitacoes" style={{ justifySelf: "start" }}>
        <Button type="button" variant="ghost">
          <ChevronLeft size={15} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
          Solicitações
        </Button>
      </Link>

      <PageHeader
        title={
          request.numeroProtocolo
            ? `Solicitação ${request.numeroProtocolo}`
            : "Solicitação (rascunho)"
        }
        subtitle={request.unidadeSolicitanteNome}
        action={
          <Link href={`/processos/solicitacoes/${request.id}/imprimir`} target="_blank">
            <Button type="button" variant="secondary">
              <Printer size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              Imprimir
            </Button>
          </Link>
        }
      />

      <RequestDetailView request={request} />

      <Card title="Documentos" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <IssueDocumentPanel
            referenciaId={request.id}
            voltarPara={`/processos/solicitacoes/${request.id}`}
            modelos={modelos.filter((modelo) => modelo.escopo === "SOLICITACAO")}
            emitidos={emitidos}
            // Rascunho não rende comprovante: nada foi pedido ainda.
            podeEmitir={request.situacao === "ENVIADA" && viewer.can("documents:issue")}
          />
        </div>
      </Card>
    </>
  );
}
