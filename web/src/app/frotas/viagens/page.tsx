import { listDrivers, listTrips, listVehicles } from "@/features/fleet/queries";
import { TripForm } from "@/features/fleet/components/TripForm";
import { TripTable } from "@/features/fleet/components/TripTable";
import { TRIP_STATUSES } from "@/features/fleet/types";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";

type TripsPageProps = {
  searchParams: Promise<{ status?: string; veiculo?: string; pagina?: string }>;
};

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const viewer = await requirePermission("fleet:read", "FROTAS");
  const { status, veiculo, pagina } = await searchParams;

  const [trips, vehicles, drivers, units] = await Promise.all([
    listTrips({ status, veiculo, pagina }),
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
      <FilterBar base="/frotas/viagens" ativo={Boolean(status || veiculo)}>
        <FilterField label="Situação" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Todas as situações</option>
            {TRIP_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Veículo" htmlFor="veiculo">
          <select id="veiculo" name="veiculo" defaultValue={veiculo ?? ""}>
            <option value="">Todos os veículos</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.placa} · {vehicle.modelo}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Card title={`${trips.total} viagens`} padded={false}>
        <TripTable trips={trips.itens} />
        <Pagination info={trips} base="/frotas/viagens" filtros={{ status, veiculo }} />
      </Card>
    </>
  );
}
