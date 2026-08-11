import { listBids } from "@/features/bids/queries";
import { ContractWizard } from "@/features/contracts/components/ContractWizard";
import { listPriceRecords } from "@/features/price-records/queries";
import { listSuppliers } from "@/features/suppliers/queries";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

export default async function NewContractPage() {
  await requirePermission("contracts:write", "PROCESSOS");
  const [units, suppliers, bids, priceRecords] = await Promise.all([
    listUnits(),
    listSuppliers(),
    listBids(),
    listPriceRecords(),
  ]);

  return (
    <>
      <PageHeader
        title="Novo contrato"
        subtitle="Origem, dados, itens e revisão — o processo administrativo é gerado ao final"
      />
      <ContractWizard
        units={units}
        suppliers={suppliers}
        bids={bids}
        priceRecords={priceRecords}
      />
    </>
  );
}
