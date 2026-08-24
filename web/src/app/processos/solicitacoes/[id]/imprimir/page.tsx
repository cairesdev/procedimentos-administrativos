import { notFound } from "next/navigation";
import { getProfile } from "@/features/auth/queries";
import { findRequest } from "@/features/requests/queries";
import { RequestDetailView } from "@/features/requests/components/RequestDetailView";
import { ApiError } from "@/shared/api/http-client";
import { getViewer, requirePermission } from "@/shared/auth/guards";
import { getOwnLetterhead } from "@/shared/letterhead/queries";
import { LetterheadSheet } from "@/shared/letterhead/LetterheadSheet";

type PrintPageProps = { params: Promise<{ id: string }> };

export default async function PrintRequestPage({ params }: PrintPageProps) {
  await requirePermission("requests:read", "PROCESSOS");
  const { id } = await params;

  const request = await findRequest(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  const [letterhead, profile, viewer] = await Promise.all([
    getOwnLetterhead(),
    getProfile(),
    getViewer(),
  ]);

  return (
    <LetterheadSheet
      letterhead={letterhead}
      orgName={profile.orgaoNome}
      title={
        request.numeroProtocolo
          ? `Solicitação de itens — protocolo ${request.numeroProtocolo}`
          : "Solicitação de itens (rascunho)"
      }
      subtitle={
        request.numeroProcessoAdm
          ? `Processo administrativo ${request.numeroProcessoAdm} · ${request.unidadeSolicitanteNome}`
          : request.unidadeSolicitanteNome
      }
      emitidoPor={viewer.name}
    >
      <RequestDetailView request={request} />
    </LetterheadSheet>
  );
}
