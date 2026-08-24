import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Ban } from "lucide-react";
import { findDocument } from "@/features/documents/queries";
import { DocumentSheet } from "@/features/documents/components/DocumentSheet";
import { CancelDocumentForm } from "@/features/documents/components/CancelDocumentForm";
import { getProfile } from "@/features/auth/queries";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { publicBaseUrl } from "@/shared/config/base-url";
import { getOwnLetterhead } from "@/shared/letterhead/queries";
import { ModalTrigger } from "@/shared/ui/Modal";

type DocumentPageProps = { params: Promise<{ id: string }> };

export default async function DocumentPage({ params }: DocumentPageProps) {
  const viewer = await requirePermission("processes:read", "PROCESSOS");
  const { id } = await params;

  const documento = await findDocument(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const [letterhead, profile, baseUrl] = await Promise.all([
    getOwnLetterhead(),
    getProfile(),
    publicBaseUrl(),
  ]);

  return (
    <>
      {/* Barra de tela: some na impressão junto com o resto do cromo. */}
      <div className="somente_tela" style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "14px 16px 0" }}>
        <Link
          href="/processos/fila"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Voltar
        </Link>

        {viewer.can("documents:issue") && !documento.canceladoEm ? (
          <ModalTrigger
            label="Cancelar documento"
            title="Cancelar documento"
            description="A peça continua conferível pelo código, marcada como sem efeito."
            icon={<Ban size={15} aria-hidden="true" />}
          >
            <CancelDocumentForm documentId={documento.id} />
          </ModalTrigger>
        ) : null}
      </div>

      <DocumentSheet
        documento={documento}
        letterhead={letterhead}
        orgName={profile.orgaoNome}
        baseUrl={baseUrl}
      />
    </>
  );
}
