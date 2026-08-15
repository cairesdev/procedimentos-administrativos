import Link from "next/link";
import { Plus } from "lucide-react";
import { listAssetIntakes } from "@/features/assets/queries";
import { AssetIntakeTable } from "@/features/assets/components/AssetIntakeTable";
import { listSuppliers } from "@/features/suppliers/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";

export default async function AssetIntakesPage() {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const [intakes, suppliers] = await Promise.all([listAssetIntakes(), listSuppliers()]);

  return (
    <>
      <PageHeader
        title="Entradas"
        subtitle="Cada entrada tomba um lote de bens de uma vez"
        action={
          viewer.can("assets:write") ? (
            <Link href="/patrimonio/entradas/nova">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Nova entrada
              </Button>
            </Link>
          ) : null
        }
      />

      <Card title={`${intakes.length} registradas`} padded={false}>
        <AssetIntakeTable
          intakes={intakes}
          suppliers={suppliers}
          canWrite={viewer.can("assets:write")}
        />
      </Card>
    </>
  );
}
