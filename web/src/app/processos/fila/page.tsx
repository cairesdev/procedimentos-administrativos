import { listProcesses } from "@/features/processes/queries";
import { ProcessTable } from "@/features/processes/components/ProcessTable";
import { countDueSoon, countLate } from "@/features/processes/deadline";
import { getActiveAssignmentId, getProfile } from "@/features/auth/queries";
import { listSectors } from "@/features/sectors/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";

export default async function ProcessQueuePage() {
  await requirePermission("processes:read", "PROCESSOS");

  const [profile, activeAssignmentId, sectors] = await Promise.all([
    getProfile(),
    getActiveAssignmentId(),
    listSectors(),
  ]);

  // A fila mostra o setor da lotação ativa; sem lotação de setor, mostra tudo.
  const active = profile.lotacoes.find((assignment) => assignment.id === activeAssignmentId)
    ?? profile.lotacoes[0];
  const sectorId = active?.setorId ?? undefined;
  const processes = await listProcesses(sectorId);

  const sectorName = sectors.find((sector) => sector.id === sectorId)?.nome;
  const atrasados = countLate(processes);
  const vencendo = countDueSoon(processes);

  return (
    <>
      <PageHeader
        title="Fila do setor"
        subtitle={
          sectorName
            ? `Processos aguardando ação em ${sectorName}`
            : "Todos os processos em andamento nesta prefeitura"
        }
      />

      {atrasados > 0 || vencendo > 0 ? (
        <div style={{ marginBottom: "14px" }}>
          <Alert tone={atrasados > 0 ? "error" : "info"}>
            {atrasados > 0
              ? `${atrasados} ${atrasados === 1 ? "processo passou" : "processos passaram"} do prazo da etapa.`
              : null}{" "}
            {vencendo > 0
              ? `${vencendo} ${vencendo === 1 ? "vence" : "vencem"} nos próximos dias.`
              : null}{" "}
            A lista já vem ordenada pelos mais urgentes.
          </Alert>
        </div>
      ) : null}

      {sectorId ? null : (
        <div style={{ marginBottom: "14px" }}>
          <Alert tone="info">
            Sua lotação ativa não é de setor, então a lista mostra todos os processos abertos.
          </Alert>
        </div>
      )}

      <Card title={`${processes.length} em andamento`} padded={false}>
        <ProcessTable processes={processes} sectors={sectors} />
      </Card>
    </>
  );
}
