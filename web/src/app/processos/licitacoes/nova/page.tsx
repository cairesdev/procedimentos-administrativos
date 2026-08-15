import { BidForm } from "@/features/bids/components/BidForm";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";

export default async function NewBidPage() {
  await requirePermission("bids:write", "PROCESSOS");
  const units = await listUnits();

  return (
    <>
      <PageHeader title="Nova licitação" subtitle="Certame que dará origem a atas e contratos" />
      <Card>
        <BidForm units={units} />
      </Card>
    </>
  );
}
