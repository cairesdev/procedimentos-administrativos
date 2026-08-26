import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";
import { findRequest } from "@/features/requests/queries";
import { RequestDetailView } from "@/features/requests/components/RequestDetailView";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { PageHeader } from "@/shared/ui/layout";

type RequestPageProps = { params: Promise<{ id: string }> };

export default async function RequestDetailPage({ params }: RequestPageProps) {
  await requirePermission("requests:read", "PROCESSOS");
  const { id } = await params;

  const request = await findRequest(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

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
    </>
  );
}
