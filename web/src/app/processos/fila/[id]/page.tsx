import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActiveAssignmentId, getProfile } from "@/features/auth/queries";
import { listContracts } from "@/features/contracts/queries";
import { findProcess } from "@/features/processes/queries";
import { ProcessActions } from "@/features/processes/components/ProcessActions";
import { ProcessTimeline } from "@/features/processes/components/ProcessTimeline";
import { listSectors } from "@/features/sectors/queries";
import { getWorkflow } from "@/features/workflows/queries";
import { requirePermission } from "@/shared/auth/guards";
import { deadlineOf } from "@/features/processes/deadline";
import { humanize, toDate } from "@/shared/ui/labels";
import { Badge, Card, Columns, PageHeader, Stack, SummaryGrid } from "@/shared/ui/layout";

type ProcessPageProps = { params: Promise<{ id: string }> };

export default async function ProcessDetailPage({ params }: ProcessPageProps) {
  const viewer = await requirePermission("processes:read", "PROCESSOS");
  const { id } = await params;

  const [process, profile, activeAssignmentId, sectors, contracts] = await Promise.all([
    findProcess(id),
    getProfile(),
    getActiveAssignmentId(),
    listSectors(),
    listContracts(),
  ]);

  // O override de destino é configurado por tipo de processo.
  const workflow = await getWorkflow(process.tipoProcesso);

  const currentSector = sectors.find((sector) => sector.id === process.setorAtualId);
  const isOpen = process.status === "ABERTO" || process.status === "TRAMITANDO";
  const prazo = deadlineOf(process);

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/processos/fila"
          style={{
            color: "var(--texto_suave)",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Fila do setor
        </Link>
      </p>

      <PageHeader
        title={`Protocolo ${process.numeroProtocolo}`}
        subtitle={`Processo administrativo ${process.numeroProcessoAdm}`}
        action={<Badge tone={isOpen ? "accent" : "success"}>{process.status.toLowerCase()}</Badge>}
      />

      <Columns>
        <Card title="Tramitação">
          <ProcessTimeline dispatches={process.despachos} />
        </Card>

        <Stack>
          <Card title="Situação">
            <SummaryGrid
              items={[
                { label: "Tipo", value: humanize(process.tipoProcesso) },
                { label: "Setor atual", value: currentSector?.nome ?? "—" },
                { label: "Despachos", value: `${process.despachos.length}` },
                { label: "No setor desde", value: toDate(process.entrouNoSetorEm) },
                {
                  label: "Prazo da etapa",
                  value:
                    prazo.state === "sem-prazo" ? (
                      "sem prazo"
                    ) : (
                      <Badge tone={prazo.tone}>{prazo.label}</Badge>
                    ),
                },
              ]}
            />
          </Card>

          {isOpen ? (
            <Card title="Ações">
              <ProcessActions
                processId={process.id}
                assignments={profile.lotacoes}
                activeAssignmentId={activeAssignmentId}
                sectors={sectors.map((sector) => ({ value: sector.id, label: sector.nome }))}
                contracts={contracts.map((contract) => ({
                  value: contract.id,
                  label: `Contrato ${contract.numero}`,
                }))}
                canDispatch={viewer.can("processes:dispatch")}
                canGiveOpinion={viewer.can("processes:opinion")}
                canEmitOrder={viewer.can("processes:order")}
                allowManualDestination={workflow?.permiteOverrideUsuario ?? false}
              />
            </Card>
          ) : null}
        </Stack>
      </Columns>
    </>
  );
}
