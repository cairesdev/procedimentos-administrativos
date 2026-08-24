import { listMaintenances, listVehicles } from "@/features/fleet/queries";
import { MaintenanceForm } from "@/features/fleet/components/MaintenanceForm";
import { MaintenanceTable } from "@/features/fleet/components/MaintenanceTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";

type MaintenancesPageProps = {
  searchParams: Promise<{ veiculo?: string; abertas?: string; pagina?: string }>;
};

export default async function MaintenancesPage({ searchParams }: MaintenancesPageProps) {
  const viewer = await requirePermission("fleet:read", "FROTAS");
  const { veiculo, abertas, pagina } = await searchParams;

  const [maintenances, vehicles] = await Promise.all([
    listMaintenances({
      veiculo,
      abertas: abertas === "" || abertas === undefined ? undefined : abertas === "true",
      pagina,
    }),
    listVehicles(),
  ]);

  const canWrite = viewer.can("fleet:write");
  const parados = vehicles.filter((vehicle) => vehicle.emManutencao);

  return (
    <>
      <PageHeader
        title="Manutenções"
        subtitle="Enquanto a manutenção está aberta, o veículo não sai"
        action={
          canWrite ? (
            <ModalTrigger label="Abrir manutenção" title="Abrir manutenção">
              <MaintenanceForm vehicles={vehicles} />
            </ModalTrigger>
          ) : null
        }
      />

      {parados.length > 0 ? (
        <Alert tone="info">
          {parados.length} veículo(s) parado(s): {parados.map((v) => v.placa).join(", ")}.
        </Alert>
      ) : null}

      <form method="get">
        <Toolbar>
          <select name="veiculo" defaultValue={veiculo ?? ""} aria-label="Veículo">
            <option value="">Todos os veículos</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.placa} · {vehicle.modelo}
              </option>
            ))}
          </select>

          <select name="abertas" defaultValue={abertas ?? ""} aria-label="Situação">
            <option value="">Abertas e concluídas</option>
            <option value="true">Só as abertas</option>
            <option value="false">Só as concluídas</option>
          </select>

          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </Toolbar>
      </form>

      <Card title={`${maintenances.total} registros`} padded={false}>
        <MaintenanceTable maintenances={maintenances.itens} canWrite={canWrite} />
        <Pagination
          info={maintenances}
          base="/frotas/manutencoes"
          filtros={{ veiculo, abertas }}
        />
      </Card>
    </>
  );
}
