import Link from "next/link";
import { Plus } from "lucide-react";
import { listBids } from "@/features/bids/queries";
import { listUnits } from "@/features/units/queries";
import { BidTable } from "@/features/bids/components/BidTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";

export default async function BidsPage() {
  const viewer = await requirePermission("bids:read", "PROCESSOS");
  const [bids, units] = await Promise.all([listBids(), listUnits()]);

  return (
    <>
      <PageHeader
        title="Licitações"
        subtitle="Uma das origens possíveis para atas e contratos"
        action={
          viewer.can("bids:write") ? (
            <Link href="/processos/licitacoes/nova">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Nova licitação
              </Button>
            </Link>
          ) : null
        }
      />

      <Card title={`${bids.length} cadastradas`} padded={false}>
        <BidTable bids={bids} canWrite={viewer.can("bids:write")} units={units} />
      </Card>
    </>
  );
}
