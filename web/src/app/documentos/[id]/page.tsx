import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Ban } from "lucide-react";
import { findDocument } from "@/features/documents/queries";
import { DocumentSheet } from "@/features/documents/components/DocumentSheet";
import { DocumentEditor } from "@/features/documents/components/DocumentEditor";
import { CancelDocumentForm } from "@/features/documents/components/CancelDocumentForm";
import { getProfile } from "@/features/auth/queries";
import { ApiError } from "@/shared/api/http-client";
import { getViewer } from "@/shared/auth/guards";
import { publicBaseUrl } from "@/shared/config/base-url";
import { getOwnLetterhead } from "@/shared/letterhead/queries";
import { Alert } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
};

/**
 * Só um caminho de volta interno é aceito. `voltar` vem da URL, e um destino
 * absoluto viraria redirecionamento aberto: link do sistema levando para fora.
 */
const destinoDeVolta = (voltar?: string): string =>
  voltar && /^\/[^/\\]/.test(voltar) ? voltar : "/";

export default async function DocumentPage({ params, searchParams }: DocumentPageProps) {
  // Guarda de sessão, sem exigir módulo. O documento é o papel de um registro
  // que o usuário já alcançou, e a peça de um atendimento de balcão pertence ao
  // módulo PROCESSOS — exigir o módulo aqui travaria a prefeitura que contratou
  // só o Protocolo. Quem garante o isolamento entre prefeituras é a API, que
  // busca o documento pelo órgão da sessão.
  const viewer = await getViewer();
  const [{ id }, { voltar }] = await Promise.all([params, searchParams]);

  const documento = await findDocument(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const [letterhead, profile, baseUrl] = await Promise.all([
    getOwnLetterhead(),
    getProfile(),
    publicBaseUrl(),
  ]);

  /**
   * Rascunho é peça em revisão, e só de quem a preparou. Para os demais — e
   * depois de emitida — a tela é a folha de sempre, sem editor.
   */
  const emRevisao = documento.situacao === "RASCUNHO";
  const podeEditar = emRevisao && documento.emitidoPorUsuarioId === viewer.id;

  return (
    <>
      {/* Barra de tela: some na impressão junto com o resto do cromo. */}
      <div className="somente_tela" style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "14px 16px 0" }}>
        <Link
          href={destinoDeVolta(voltar)}
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Voltar
        </Link>

        {viewer.can("documents:issue") && !emRevisao && !documento.canceladoEm ? (
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

      {podeEditar ? (
        <DocumentEditor
          documentId={documento.id}
          corpo={documento.corpo}
          corpoOriginal={documento.corpoOriginal}
          voltarPara={destinoDeVolta(voltar)}
        />
      ) : (
        <>
          {emRevisao ? (
            <div className="somente_tela" style={{ padding: "14px 16px 0" }}>
              <Alert tone="info">
                Rascunho de {documento.emitidoPorNome}, ainda em revisão. Só quem o preparou pode
                editá-lo ou emiti-lo.
              </Alert>
            </div>
          ) : null}

          <DocumentSheet
            documento={documento}
            letterhead={letterhead}
            orgName={profile.orgaoNome}
            baseUrl={baseUrl}
          />
        </>
      )}
    </>
  );
}
