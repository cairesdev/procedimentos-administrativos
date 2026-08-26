import { notFound } from "next/navigation";
import { getInventory } from "@/features/assets/queries";
import { InventorySheet } from "@/features/assets/components/InventorySheet";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader, SummaryGrid } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";

type InventoryPageProps = { params: Promise<{ id: string }> };

export default async function InventoryPage({ params }: InventoryPageProps) {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const { id } = await params;

  const inventory = await getInventory(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  // A prefeitura pode ter desativado os modelos, ou nem ter emitido nada
  // ainda: nenhum dos dois é motivo para derrubar a folha de conferência.
  const [modelos, emitidos] = await Promise.all([
    listTemplates("PATRIMONIO").catch(() => []),
    listDocumentsFor(id).catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title={`Inventário · ${inventory.localNome}`}
        subtitle={`Aberto em ${toDate(inventory.dataInicio)}`}
      />

      <Card>
        <SummaryGrid
          items={[
            { label: "Situação", value: inventory.status === "ABERTO" ? "Aberto" : "Concluído" },
            { label: "Bens esperados", value: inventory.esperados },
            { label: "Conferidos", value: inventory.conferidos },
            { label: "Divergências", value: inventory.divergencias },
            {
              label: "Conclusão",
              value: inventory.dataConclusao ? toDate(inventory.dataConclusao) : "—",
            },
          ]}
        />
      </Card>

      <Card title="Folha de conferência" padded={false}>
        <InventorySheet inventory={inventory} canWrite={viewer.can("assets:write")} />
      </Card>

      <Card title="Documentos" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <IssueDocumentPanel
            referenciaId={inventory.id}
            voltarPara={`/patrimonio/inventarios/${inventory.id}`}
            modelos={modelos.filter((modelo) => modelo.escopo === "INVENTARIO")}
            emitidos={emitidos}
            podeEmitir={viewer.can("documents:issue")}
          />
        </div>
      </Card>
    </>
  );
}
