import { listBids } from "@/features/bids/queries";
import { BidForm } from "@/features/bids/components/BidForm";
import { BidTable } from "@/features/bids/components/BidTable";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Card, Columns, PageHeader } from "@/shared/ui/layout";

export default async function BidsPage() {
  const viewer = await requirePermission("bids:read", "PROCESSOS");
  const [bids, units] = await Promise.all([listBids(), listUnits()]);

  return (
    <>
      <PageHeader title="Licitações" subtitle="Certames que originam atas e contratos" />

      <Columns>
        <Card title={`${bids.length} cadastradas`} padded={false}>
          <BidTable bids={bids} />
        </Card>

        {viewer.can("bids:write") ? (
          <Card title="Nova licitação">
            <BidForm units={units} />
          </Card>
        ) : null}
      </Columns>
    </>
  );
}
