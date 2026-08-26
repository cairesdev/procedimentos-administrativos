import { listAssetCategories, listAssetLocations, listAssets } from "@/features/assets/queries";
import { AssetFilters } from "@/features/assets/components/AssetFilters";
import { AssetTable } from "@/features/assets/components/AssetTable";
import { listTemplates } from "@/features/documents/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { Pagination } from "@/shared/ui/Pagination";

type AssetsPageProps = {
  searchParams: Promise<{ local?: string; status?: string; pagina?: string }>;
};

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const { local, status, pagina } = await searchParams;
  const [assets, locations, categories, modelos] = await Promise.all([
    listAssets({ local, status, pagina }),
    listAssetLocations(),
    listAssetCategories(),
    listTemplates("PATRIMONIO").catch(() => []),
  ]);

  return (
    <>
      <PageHeader title="Bens" subtitle="Tudo que já foi tombado, com onde está e em que estado" />

      <AssetFilters locations={locations} selectedLocation={local} selectedStatus={status} />

      <Card title={`${assets.total} bens`} padded={false}>
        <AssetTable
          assets={assets.itens}
          categories={categories}
          locations={locations}
          canWrite={viewer.can("assets:write")}
          canIssue={viewer.can("documents:issue")}
          modelos={modelos}
        />
        <Pagination info={assets} base="/patrimonio/bens" filtros={{ local, status }} />
      </Card>
    </>
  );
}
