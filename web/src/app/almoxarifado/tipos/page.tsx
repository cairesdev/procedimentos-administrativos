import { listStockTypes } from "@/features/stock/queries";
import { StockTypeForm } from "@/features/stock/components/StockTypeForm";
import { StockTypeTable } from "@/features/stock/components/StockTypeTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function StockTypesPage() {
  const viewer = await requirePermission("stock:manage", "ALMOXARIFADO");
  const types = await listStockTypes();
  const canWrite = viewer.can("stock:manage");

  return (
    <>
      <PageHeader
        title="Tipos de estoque"
        subtitle="Alimentação escolar, limpeza, expediente — a categoria dentro do almoxarifado"
        action={
          canWrite ? (
            <ModalTrigger label="Novo tipo" title="Novo tipo de estoque">
              <StockTypeForm />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${types.length} cadastrados`} padded={false}>
        <StockTypeTable types={types} canWrite={canWrite} />
      </Card>
    </>
  );
}
