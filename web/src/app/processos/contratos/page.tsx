import Link from "next/link";
import { Plus } from "lucide-react";
import { listContracts } from "@/features/contracts/queries";
import { ContractTable } from "@/features/contracts/components/ContractTable";
import { listAllSuppliers } from "@/features/suppliers/queries";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";
import { Pagination } from "@/shared/ui/Pagination";

type ContractsPageProps = { searchParams: Promise<{ pagina?: string }> };

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const viewer = await requirePermission("contracts:read", "PROCESSOS");
  const { pagina } = await searchParams;

  const [contracts, suppliers, units] = await Promise.all([
    listContracts(pagina),
    // Lista inteira: a tabela resolve o nome do fornecedor de cada contrato,
    // e uma página de fornecedores deixaria linhas sem nome.
    listAllSuppliers(),
    listUnits(),
  ]);

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle="Cada contrato nasce de uma licitação ou ata e gera processo administrativo"
        action={
          viewer.can("contracts:write") ? (
            <Link href="/processos/contratos/novo">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Novo contrato
              </Button>
            </Link>
          ) : null
        }
      />

      <Card title={`${contracts.total} cadastrados`} padded={false}>
        <ContractTable
          contracts={contracts.itens}
          suppliers={suppliers}
          units={units}
          canWrite={viewer.can("contracts:write")}
        />
        <Pagination info={contracts} base="/processos/contratos" />
      </Card>
    </>
  );
}
