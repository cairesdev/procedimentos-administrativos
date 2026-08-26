import { listWarehouses } from "@/features/stock/queries";
import { WarehouseForm } from "@/features/stock/components/WarehouseForm";
import { WarehouseTable } from "@/features/stock/components/WarehouseTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function WarehousesPage() {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const warehouses = await listWarehouses();
  const canWrite = viewer.can("stock:manage");

  return (
    <>
      <PageHeader
        title="Almoxarifados"
        subtitle="Cada secretaria costuma ter o seu; o local atendido é vinculado a um"
        action={
          canWrite ? (
            <ModalTrigger label="Novo almoxarifado" title="Novo almoxarifado">
              <WarehouseForm />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${warehouses.length} cadastrados`} padded={false}>
        <WarehouseTable warehouses={warehouses} canWrite={canWrite} />
      </Card>
    </>
  );
}
