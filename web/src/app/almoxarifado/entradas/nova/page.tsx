import { listStockTypes, listWarehouses } from "@/features/stock/queries";
import { IntakeWizard } from "@/features/stock/components/IntakeWizard";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

export default async function NewIntakePage() {
  await requirePermission("stock:manage", "ALMOXARIFADO");
  const [warehouses, types] = await Promise.all([listWarehouses(), listStockTypes()]);

  return (
    <>
      <PageHeader
        title="Nova entrada"
        subtitle="Cada linha vira um lote com saldo e validade próprios"
      />
      <IntakeWizard warehouses={warehouses} types={types} />
    </>
  );
}
