import Link from "next/link";
import { Plus } from "lucide-react";
import { listContracts } from "@/features/contracts/queries";
import { ContractTable } from "@/features/contracts/components/ContractTable";
import { listSuppliers } from "@/features/suppliers/queries";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";

export default async function ContractsPage() {
  const viewer = await requirePermission("contracts:read", "PROCESSOS");
  const [contracts, suppliers, units] = await Promise.all([
    listContracts(),
    listSuppliers(),
    listUnits(),
  ]);

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle="Cada contrato nasce de uma licitação ou ata e gera processo administrativo"
        action={
          viewer.can("contracts:write") ? (
            <Link href="/contratos/novo">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Novo contrato
              </Button>
            </Link>
          ) : null
        }
      />

      <Card title={`${contracts.length} cadastrados`} padded={false}>
        <ContractTable
          contracts={contracts}
          suppliers={suppliers}
          units={units}
          canWrite={viewer.can("contracts:write")}
        />
      </Card>
    </>
  );
}
