import { notFound } from "next/navigation";
import { getIntake } from "@/features/stock/queries";
import { BatchTable } from "@/features/stock/components/BatchTable";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader, SummaryGrid } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";

type IntakePageProps = { params: Promise<{ id: string }> };

export default async function IntakePage({ params }: IntakePageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { id } = await params;

  const intake = await getIntake(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const [modelos, emitidos] = await Promise.all([
    listTemplates("ALMOXARIFADO").catch(() => []),
    listDocumentsFor(id).catch(() => []),
  ]);

  return (
    <>
      <PageHeader title={`Entrada ${intake.codigo}`} subtitle={intake.titulo} />

      <Card>
        <SummaryGrid
          items={[
            { label: "Almoxarifado", value: intake.almoxarifadoNome },
            { label: "Tipo de estoque", value: intake.tipoEstoqueNome },
            { label: "Data de entrada", value: toDate(intake.data) },
            { label: "Local armazenado", value: intake.localArmazenado ?? "—" },
            { label: "Nota fiscal", value: intake.notaFiscal ?? "—" },
            { label: "Fornecedor", value: intake.fornecedorRazaoSocial ?? "—" },
            { label: "Responsável", value: intake.responsavelNome },
            { label: "Lotes", value: intake.lotes.length },
          ]}
        />
      </Card>

      <Card title="Lotes" padded={false}>
        <BatchTable batches={intake.lotes} canWrite={viewer.can("stock:manage")} />
      </Card>

      <Card title="Documentos" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <IssueDocumentPanel
            referenciaId={intake.id}
            voltarPara={`/almoxarifado/entradas/${intake.id}`}
            modelos={modelos.filter((modelo) => modelo.escopo === "ENTRADA_ESTOQUE")}
            emitidos={emitidos}
            podeEmitir={viewer.can("documents:issue")}
          />
        </div>
      </Card>
    </>
  );
}
