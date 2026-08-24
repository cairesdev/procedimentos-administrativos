import Link from "next/link";
import { Plus } from "lucide-react";
import { listAssetIntakes } from "@/features/assets/queries";
import { AssetIntakeTable } from "@/features/assets/components/AssetIntakeTable";
import { listAllSuppliers } from "@/features/suppliers/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";
import { Pagination } from "@/shared/ui/Pagination";

type AssetIntakesPageProps = { searchParams: Promise<{ pagina?: string }> };

export default async function AssetIntakesPage({ searchParams }: AssetIntakesPageProps) {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const { pagina } = await searchParams;

  const [intakes, suppliers] = await Promise.all([
    listAssetIntakes(pagina),
    // A tabela mostra o nome do fornecedor de cada entrada: precisa da lista
    // toda, não de uma página dela.
    listAllSuppliers(),
  ]);

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

      <Card title={`${intakes.total} registradas`} padded={false}>
        <AssetIntakeTable
          intakes={intakes.itens}
          suppliers={suppliers}
          canWrite={viewer.can("assets:write")}
        />
        <Pagination info={intakes} base="/patrimonio/entradas" />
      </Card>
    </>
  );
}
