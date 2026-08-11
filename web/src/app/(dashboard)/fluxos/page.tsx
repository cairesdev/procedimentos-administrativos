import { listSectors } from "@/features/sectors/queries";
import { getWorkflow } from "@/features/workflows/queries";
import { WorkflowForm } from "@/features/workflows/components/WorkflowForm";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader, Stack } from "@/shared/ui/layout";

const PROCESS_TYPE = "SOLICITACAO_ITENS";

export default async function WorkflowsPage() {
  await requirePermission("workflows:read", "PROCESSOS");
  const [sectors, workflow] = await Promise.all([listSectors(), getWorkflow(PROCESS_TYPE)]);

  return (
    <>
      <PageHeader
        title="Fluxo de processos"
        subtitle="Ordem dos setores, prazos e visibilidade por etapa"
      />

      <Stack>
        {workflow ? null : (
          <Alert tone="info">
            Nenhum fluxo configurado para solicitação de itens. Sem fluxo, as solicitações não podem
            ser enviadas.
          </Alert>
        )}

        <Card title="Configuração">
          <WorkflowForm sectors={sectors} workflow={workflow} processType={PROCESS_TYPE} />
        </Card>
      </Stack>
    </>
  );
}
