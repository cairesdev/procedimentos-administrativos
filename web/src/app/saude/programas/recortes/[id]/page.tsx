import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getProgramCut, getProgramReport } from "@/features/programs/queries";
import { ReportView } from "@/features/programs/components/ReportView";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import type { DocumentTemplate, IssuedDocument } from "@/features/documents/types";
import { ApiError } from "@/shared/api/http-client";
import { lista } from "@/shared/api/colecao";
import { requirePermission } from "@/shared/auth/guards";
import { toDate } from "@/shared/ui/labels";
import { Alert, Card, PageHeader, Stack } from "@/shared/ui/layout";

type Props = { params: Promise<{ id: string }> };

/**
 * O recorte salvo, e o caminho até a peça assinada.
 *
 * O que ficou gravado foi a pergunta — programa e período. Os números são
 * reapurados aqui, pelo mesmo caso de uso da tela de filtros, e só se congelam
 * na emissão, dentro do corpo do documento. É o que impede o papel entregue à
 * Promotoria e a tela da coordenação de contarem histórias diferentes sobre a
 * mesma fila.
 */
export default async function RecortePage({ params }: Props) {
  const viewer = await requirePermission("programs:read", "SAUDE");
  const { id } = await params;

  const recorte = await getProgramCut(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });
  if (!recorte?.id) notFound();

  const [relatorio, modelos, emitidos] = await Promise.all([
    getProgramReport(recorte.programaId, recorte.desde, recorte.ate).catch(() => null),
    listTemplates("SAUDE").then(lista<DocumentTemplate>).catch(() => []),
    listDocumentsFor(id).then(lista<IssuedDocument>).catch(() => []),
  ]);

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/saude/programas/relatorio"
          style={{
            color: "var(--texto_suave)", fontSize: "13px",
            display: "inline-flex", alignItems: "center", gap: "4px",
          }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Relatório
        </Link>
      </p>

      <PageHeader
        title={recorte.programaNome}
        subtitle={`Período apurado: ${toDate(recorte.desde)} a ${toDate(recorte.ate)}`}
      />

      <Stack>
        <Alert tone="info">
          Os números abaixo são apurados agora. Ao emitir, eles ficam presos ao
          corpo do documento, com código de conferência — o papel continua
          dizendo daqui a um ano o que se via hoje.
        </Alert>

        {relatorio ? (
          <ReportView relatorio={relatorio} />
        ) : (
          <Card>
            <p>Não foi possível apurar o relatório deste recorte.</p>
          </Card>
        )}

        <Card title="Documentos" padded={false}>
          <div style={{ padding: "14px 16px 0" }}>
            <IssueDocumentPanel
              referenciaId={id}
              voltarPara={`/saude/programas/recortes/${id}`}
              modelos={modelos.filter((modelo) => modelo.escopo === "RELATORIO_PROGRAMA")}
              emitidos={emitidos}
              podeEmitir={viewer.can("documents:issue")}
            />
          </div>
        </Card>
      </Stack>
    </>
  );
}
