import { listContractItems, listContracts } from "@/features/contracts/queries";
import { RequestBuilder, type ContractWithItems } from "@/features/requests/components/RequestBuilder";
import { listSuppliers } from "@/features/suppliers/queries";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

export default async function NewRequestPage() {
  await requirePermission("requests:create", "PROCESSOS");

  const [contracts, units, suppliers] = await Promise.all([
    listContracts(),
    listUnits(),
    listSuppliers(),
  ]);

  // Só contratos vigentes entram na montagem do pedido.
  const active = contracts.filter(
    (contract) => !contract.dataFim || new Date(contract.dataFim) >= new Date(),
  );

  const withItems: ContractWithItems[] = await Promise.all(
    active.map(async (contract) => ({
      ...contract,
      fornecedor:
        suppliers.find((supplier) => supplier.id === contract.fornecedorId)?.razaoSocial ??
        "Fornecedor",
      itens: await listContractItems(contract.id),
    })),
  );

  return (
    <>
      <PageHeader
        title="Nova solicitação"
        subtitle="Escolha itens de um ou mais contratos — o saldo é reservado no envio"
      />
      <RequestBuilder units={units} contracts={withItems.filter((c) => c.itens.length > 0)} />
    </>
  );
}
