import { listBids } from "@/features/bids/queries";
import { PriceRecordForm } from "@/features/price-records/components/PriceRecordForm";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

export default async function NewPriceRecordPage() {
  await requirePermission("bids:write", "PROCESSOS");
  const bids = await listBids();

  return (
    <>
      <PageHeader
        title="Nova ata de registro de preços"
        subtitle="Itens com preço registrado, disponíveis para virar contrato"
      />
      <PriceRecordForm bids={bids} />
    </>
  );
}
