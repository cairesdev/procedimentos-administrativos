import { listDrivers, listTrips, listVehicles } from "@/features/fleet/queries";
import { TripForm } from "@/features/fleet/components/TripForm";
import { TripTable } from "@/features/fleet/components/TripTable";
import { TRIP_STATUSES } from "@/features/fleet/types";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

type TripsPageProps = {
  searchParams: Promise<{ status?: string; veiculo?: string }>;
};

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const viewer = await requirePermission("fleet:read", "FROTAS");
  const { status, veiculo } = await searchParams;

  const [trips, vehicles, drivers, units] = await Promise.all([
    listTrips({ status, veiculo }),
    listVehicles(),
    listDrivers(),
    listUnits(),
  ]);

  return (
    <>
      <PageHeader
        title="Viagens"
        subtitle="Do pedido da unidade até a devolução do veículo"
        action={
          viewer.can("trips:create") ? (
            <ModalTrigger
              label="Solicitar viagem"
              title="Solicitar viagem"
              description="O gestor da frota aprova, recusa ou propõe outra data."
            >
              <TripForm units={units} vehicles={vehicles} drivers={drivers} />
            </ModalTrigger>
          ) : null
        }
      />

      {/* Formulário GET: o filtro fica na URL e sobrevive ao recarregar. */}
      <form method="get">
        <Toolbar>
          <select name="status" defaultValue={status ?? ""} aria-label="Situação">
            <option value="">Todas as situações</option>
            {TRIP_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select name="veiculo" defaultValue={veiculo ?? ""} aria-label="Veículo">
            <option value="">Todos os veículos</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.placa} · {vehicle.modelo}
              </option>
            ))}
          </select>

          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </Toolbar>
      </form>

      <Card title={`${trips.length} viagens`} padded={false}>
        <TripTable trips={trips} />
      </Card>
    </>
  );
}
