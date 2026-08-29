import { notFound } from "next/navigation";
import { getConsumptionReport } from "@/features/stock/queries";
import { ConsumptionReportView } from "@/features/stock/components/ConsumptionReportView";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";

type ReportPageProps = { params: Promise<{ id: string }> };

export default async function ConsumptionReportPage({ params }: ReportPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { id } = await params;

  const relatorio = await getConsumptionReport(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const [modelos, emitidos] = await Promise.all([
    listTemplates("ALMOXARIFADO").catch(() => []),
    listDocumentsFor(id).catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title={`Consumo · ${toDate(relatorio.periodoInicio)} a ${toDate(relatorio.periodoFim)}`}
        subtitle={`${relatorio.almoxarifadoNome} · ${relatorio.tipoEstoqueNome ?? "todos os tipos"}`}
      />

      <ConsumptionReportView relatorio={relatorio} />

      <Card title="Documentos" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <IssueDocumentPanel
            referenciaId={relatorio.id}
            voltarPara={`/almoxarifado/relatorios/${relatorio.id}`}
            modelos={modelos.filter((modelo) => modelo.escopo === "RELATORIO_CONSUMO")}
            emitidos={emitidos}
            // A peça congela o apurado: o relatório aberto acompanha o estoque
            // de hoje, e o documento guarda o que era verdade quando saiu.
            podeEmitir={viewer.can("documents:issue")}
          />
        </div>
      </Card>
    </>
  );
}
