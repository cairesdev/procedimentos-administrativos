import Link from "next/link";
import { Plus } from "lucide-react";
import { listProcesses } from "@/features/processes/queries";
import { ProcessTable } from "@/features/processes/components/ProcessTable";
import { listSectors } from "@/features/sectors/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";

export default async function RequestsPage() {
  const viewer = await requirePermission("requests:read", "PROCESSOS");
  const [processes, sectors] = await Promise.all([listProcesses(), listSectors()]);

  const requests = processes.filter((process) => process.tipoProcesso === "SOLICITACAO_ITENS");

  return (
    <>
      <PageHeader
        title="Solicitações"
        subtitle="Pedidos de itens de contrato em tramitação"
        action={
          viewer.can("requests:create") ? (
            <Link href="/solicitacoes/nova">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Nova solicitação
              </Button>
            </Link>
          ) : null
        }
      />

      <Card title={`${requests.length} em tramitação`} padded={false}>
        <ProcessTable processes={requests} sectors={sectors} />
      </Card>
    </>
  );
}
