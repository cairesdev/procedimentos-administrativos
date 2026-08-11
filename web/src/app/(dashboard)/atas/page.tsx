import Link from "next/link";
import { Plus } from "lucide-react";
import { listPriceRecords } from "@/features/price-records/queries";
import { PriceRecordTable } from "@/features/price-records/components/PriceRecordTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";

export default async function PriceRecordsPage() {
  const viewer = await requirePermission("bids:read", "PROCESSOS");
  const records = await listPriceRecords();

  return (
    <>
      <PageHeader
        title="Atas de registro de preços"
        subtitle="Origem alternativa à licitação na hora de firmar o contrato"
        action={
          viewer.can("bids:write") ? (
            <Link href="/atas/nova">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Nova ata
              </Button>
            </Link>
          ) : null
        }
      />

      <Card title={`${records.length} cadastradas`} padded={false}>
        <PriceRecordTable records={records} canWrite={viewer.can("bids:write")} />
      </Card>
    </>
  );
}
