import { listAssetCategories, listAssetLocations } from "@/features/assets/queries";
import { AssetIntakeWizard } from "@/features/assets/components/AssetIntakeWizard";
import { listAllSuppliers } from "@/features/suppliers/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, PageHeader } from "@/shared/ui/layout";

export default async function NewAssetIntakePage() {
  await requirePermission("assets:write", "PATRIMONIO");
  const [locations, categories, suppliers] = await Promise.all([
    listAssetLocations(),
    listAssetCategories(),
    listAllSuppliers(),
  ]);

  const ready =
    locations.some((location) => location.ativo) && categories.some((category) => category.ativo);

  return (
    <>
      <PageHeader
        title="Nova entrada"
        subtitle="Informe de onde vieram os bens e quantos vão para cada local"
      />

      {ready ? (
        <AssetIntakeWizard locations={locations} categories={categories} suppliers={suppliers} />
      ) : (
        <Alert tone="info">
          Cadastre ao menos um local e uma categoria ativos antes de registrar entradas.
        </Alert>
      )}
    </>
  );
}
