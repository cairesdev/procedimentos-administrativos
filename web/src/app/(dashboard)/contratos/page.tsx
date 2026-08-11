import { listBids } from "@/features/bids/queries";
import { listContracts } from "@/features/contracts/queries";
import { ContractForm } from "@/features/contracts/components/ContractForm";
import { ContractTable } from "@/features/contracts/components/ContractTable";
import { listSuppliers } from "@/features/suppliers/queries";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader, Stack } from "@/shared/ui/layout";

export default async function ContractsPage() {
  const viewer = await requirePermission("contracts:read", "PROCESSOS");
  const [contracts, suppliers, bids, units] = await Promise.all([
    listContracts(),
    listSuppliers(),
    listBids(),
    listUnits(),
  ]);

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle="Cada contrato nasce com processo administrativo e itens com saldo"
      />

      <Stack>
        <Card title={`${contracts.length} cadastrados`} padded={false}>
          <ContractTable contracts={contracts} suppliers={suppliers} />
        </Card>

        {viewer.can("contracts:write") ? (
          <Card title="Novo contrato">
            <ContractForm units={units} suppliers={suppliers} bids={bids} />
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
