import { listAssetCategories, listAssetLocations, listAssets } from "@/features/assets/queries";
import { AssetFilters } from "@/features/assets/components/AssetFilters";
import { AssetTable } from "@/features/assets/components/AssetTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";

type AssetsPageProps = {
  searchParams: Promise<{ local?: string; status?: string }>;
};

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const { local, status } = await searchParams;
  const [assets, locations, categories] = await Promise.all([
    listAssets({ local, status }),
    listAssetLocations(),
    listAssetCategories(),
  ]);

  return (
    <>
      <PageHeader title="Bens" subtitle="Tudo que já foi tombado, com onde está e em que estado" />

      <AssetFilters locations={locations} selectedLocation={local} selectedStatus={status} />

      <Card title={`${assets.length} bens`} padded={false}>
        <AssetTable
          assets={assets}
          categories={categories}
          canWrite={viewer.can("assets:write")}
        />
      </Card>
    </>
  );
}
