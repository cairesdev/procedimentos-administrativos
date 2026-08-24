import Link from "next/link";
import { Plus } from "lucide-react";
import { listPriceRecords } from "@/features/price-records/queries";
import { PriceRecordTable } from "@/features/price-records/components/PriceRecordTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";
import { Pagination } from "@/shared/ui/Pagination";

type PriceRecordsPageProps = { searchParams: Promise<{ pagina?: string }> };

export default async function PriceRecordsPage({ searchParams }: PriceRecordsPageProps) {
  const viewer = await requirePermission("bids:read", "PROCESSOS");
  const { pagina } = await searchParams;
  const records = await listPriceRecords(pagina);

  return (
    <>
      <PageHeader
        title="Atas de registro de preços"
        subtitle="Origem alternativa à licitação na hora de firmar o contrato"
        action={
          viewer.can("bids:write") ? (
            <Link href="/processos/atas/nova">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Nova ata
              </Button>
            </Link>
          ) : null
        }
      />

      <Card title={`${records.total} cadastradas`} padded={false}>
        <PriceRecordTable records={records.itens} canWrite={viewer.can("bids:write")} />
        <Pagination info={records} base="/processos/atas" />
      </Card>
    </>
  );
}
