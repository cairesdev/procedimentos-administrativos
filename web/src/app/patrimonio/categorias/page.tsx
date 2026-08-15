import { listAssetCategories } from "@/features/assets/queries";
import { AssetCategoryForm } from "@/features/assets/components/AssetCategoryForm";
import { AssetCategoryTable } from "@/features/assets/components/AssetCategoryTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function AssetCategoriesPage() {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const categories = await listAssetCategories();
  const canWrite = viewer.can("assets:write");

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Como os bens são classificados: mobiliário, informática, veículos…"
        action={
          canWrite ? (
            <ModalTrigger label="Nova categoria" title="Nova categoria">
              <AssetCategoryForm />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${categories.length} cadastradas`} padded={false}>
        <AssetCategoryTable categories={categories} canWrite={canWrite} />
      </Card>
    </>
  );
}
