import { notFound } from "next/navigation";
import { getInventory } from "@/features/assets/queries";
import { InventorySheet } from "@/features/assets/components/InventorySheet";
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
    </>
  );
}
