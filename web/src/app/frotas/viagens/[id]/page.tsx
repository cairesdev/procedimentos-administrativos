import { notFound } from "next/navigation";
import { getTrip, listDrivers, listRefuels } from "@/features/fleet/queries";
import { TripActions } from "@/features/fleet/components/TripActions";
import { RefuelPanel } from "@/features/fleet/components/RefuelPanel";
import { TRIP_STATUSES } from "@/features/fleet/types";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader, SummaryGrid } from "@/shared/ui/layout";
import { toCurrency, toDateTime } from "@/shared/ui/labels";

type TripPageProps = { params: Promise<{ id: string }> };

export default async function TripPage({ params }: TripPageProps) {
  const viewer = await requirePermission("fleet:read", "FROTAS");
  const { id } = await params;

  const trip = await getTrip(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  // Abastecimento só existe a partir da retirada.
  const jaSaiu = trip.status === "RETIRADA" || trip.status === "FINALIZADA";
  const [drivers, refuels, modelos, emitidos] = await Promise.all([
    listDrivers(),
    jaSaiu ? listRefuels(trip.id) : Promise.resolve([]),
    listTemplates("FROTAS").catch(() => []),
    listDocumentsFor(trip.id).catch(() => []),
  ]);
  const situacao = TRIP_STATUSES.find((item) => item.value === trip.status)?.label ?? trip.status;
  const quando = trip.dataHoraRemarcada ?? trip.dataHoraDesejada;

  return (
    <>
      <PageHeader
        title={`Viagem · ${trip.veiculoPlaca}`}
        subtitle={`${situacao} — ${toDateTime(quando)}`}
      />

      <Card>
        <SummaryGrid
          items={[
            { label: "Unidade solicitante", value: trip.unidadeSolicitanteNome },
            { label: "Veículo", value: `${trip.veiculoPlaca} · ${trip.veiculoModelo}` },
            { label: "Motorista escalado", value: trip.motoristaNome },
            { label: "Responsável", value: trip.responsavel },
            { label: "Data pedida", value: toDateTime(trip.dataHoraDesejada) },
            {
              label: "Data remarcada",
              value: trip.dataHoraRemarcada ? toDateTime(trip.dataHoraRemarcada) : "—",
            },
          ]}
        />
      </Card>

      <Card title="Motivo">
        <p>{trip.motivo}</p>
      </Card>

      {trip.retirada ? (
        <Card title="Retirada">
          <SummaryGrid
            items={[
              { label: "Saída", value: toDateTime(trip.retirada.dataHora) },
              { label: "Km inicial", value: trip.retirada.kmInicial },
              { label: "Motorista", value: trip.retirada.motoristaNome },
              {
                label: "Nota de combustível",
                value:
                  trip.retirada.notaCombustivelTipo === null
                    ? "Não emitida"
                    : trip.retirada.notaCombustivelTipo === "VALOR"
                      ? toCurrency(trip.retirada.notaCombustivelQuantidade ?? 0)
                      : `${trip.retirada.notaCombustivelQuantidade} L`,
              },
            ]}
          />
        </Card>
      ) : null}

      {trip.finalizacao && trip.retirada ? (
        <Card title="Finalização">
          <SummaryGrid
            items={[
              { label: "Chegada", value: toDateTime(trip.finalizacao.dataHora) },
              { label: "Km final", value: trip.finalizacao.kmFinal },
              {
                label: "Percorrido",
                value: `${(trip.finalizacao.kmFinal - trip.retirada.kmInicial).toFixed(1)} km`,
              },
              { label: "Sinistro", value: trip.finalizacao.sinistro ?? "Nenhum" },
            ]}
          />
        </Card>
      ) : null}

      {jaSaiu ? (
        <Card title="Abastecimentos">
          <RefuelPanel
            tripId={trip.id}
            refuels={refuels}
            canWrite={viewer.can("fleet:write") && trip.status !== "CANCELADA"}
          />
        </Card>
      ) : null}

      <Card title="Documentos" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <IssueDocumentPanel
            referenciaId={trip.id}
            voltarPara={`/frotas/viagens/${trip.id}`}
            // Só o que fala da viagem: a ordem de manutenção é do veículo e
            // sai na tela de manutenções, com outra referência.
            modelos={modelos.filter((modelo) => modelo.escopo === "VIAGEM")}
            emitidos={emitidos}
            // Viagem cancelada não gera autorização: seria papel autorizando
            // uma saída que a própria prefeitura já negou.
            podeEmitir={viewer.can("documents:issue") && trip.status !== "CANCELADA"}
          />
        </div>
      </Card>

      <Card title="Ações">
        <TripActions trip={trip} drivers={drivers} canManage={viewer.can("fleet:write")} />
      </Card>
    </>
  );
}
