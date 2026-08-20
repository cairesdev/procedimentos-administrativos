import Link from "next/link";
import { Badge, Table } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import { TRIP_STATUSES, type Trip, type TripStatus } from "../types";

const tone: Record<TripStatus, "neutral" | "success" | "warning" | "accent"> = {
  SOLICITADA: "accent",
  REMARCADA: "warning",
  APROVADA: "success",
  RETIRADA: "accent",
  FINALIZADA: "neutral",
  RECUSADA: "warning",
  CANCELADA: "neutral",
};

const rotulo = (status: TripStatus) =>
  TRIP_STATUSES.find((item) => item.value === status)?.label ?? status;

export const TripTable = ({ trips }: { trips: Trip[] }) => (
  <Table
    columns={["Quando", "Veículo", "Motorista", "Unidade", "Motivo", "Situação"]}
    isEmpty={trips.length === 0}
    emptyMessage="Nenhuma viagem com esses filtros."
  >
    {trips.map((trip) => (
      <tr key={trip.id}>
        <td>
          <Link href={`/frotas/viagens/${trip.id}`}>
            {toDateTime(trip.dataHoraRemarcada ?? trip.dataHoraDesejada)}
          </Link>
          {/* Remarcada: mostra o que foi pedido, para o solicitante se situar. */}
          {trip.dataHoraRemarcada ? (
            <>
              <br />
              <small>pedido: {toDateTime(trip.dataHoraDesejada)}</small>
            </>
          ) : null}
        </td>
        <td>
          <strong>{trip.veiculoPlaca}</strong>
          <br />
          <small>{trip.veiculoModelo}</small>
        </td>
        <td>{trip.motoristaNome}</td>
        <td>{trip.unidadeSolicitanteNome}</td>
        <td>{trip.motivo.length > 60 ? `${trip.motivo.slice(0, 60)}…` : trip.motivo}</td>
        <td>
          <Badge tone={tone[trip.status]}>{rotulo(trip.status)}</Badge>
        </td>
      </tr>
    ))}
  </Table>
);
