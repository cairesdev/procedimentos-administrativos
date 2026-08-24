import { redirect } from "next/navigation";
import { apiRequest, ApiError } from "@/shared/api/http-client";
import { DocumentSheet } from "@/features/documents/components/DocumentSheet";
import type { DocumentCheck } from "@/features/documents/types";
import { publicBaseUrl } from "@/shared/config/base-url";
import { Alert } from "@/shared/ui/layout";

type ConferenciaProps = { params: Promise<{ codigo: string }> };

/**
 * Página pública: nenhuma sessão, nenhum dado interno. Mostra exatamente o
 * corpo congelado na emissão — é isso que faz o QR valer alguma coisa.
 */
export default async function ConferirDocumentoPage({ params }: ConferenciaProps) {
  const { codigo } = await params;

  const documento = await apiRequest<DocumentCheck>(
    `/conferencia/${encodeURIComponent(codigo)}`,
  ).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) redirect("/conferencia?erro=1");
    throw erro;
  });

  const baseUrl = await publicBaseUrl();

  return (
    <>
      <div className="somente_tela" style={{ maxWidth: "820px", margin: "0 auto", padding: "20px 24px 0" }}>
        <Alert tone={documento.canceladoEm ? "error" : "success"}>
          {documento.canceladoEm
            ? "Este documento existe, mas foi cancelado e não produz efeito."
            : `Documento autêntico, emitido por ${documento.orgaoNome}.`}
        </Alert>
      </div>

      <DocumentSheet
        documento={documento}
        // A conferência é pública e não tem sessão: sem timbre da prefeitura,
        // porque a logomarca só desce autenticada. O que atesta a origem aqui
        // é o próprio registro, não o brasão.
        letterhead={{ arquivoLogomarca: null, cabecalhoTimbre: documento.orgaoNome, rodapeTimbre: null }}
        orgName={documento.orgaoNome}
        baseUrl={baseUrl}
      />
    </>
  );
}
