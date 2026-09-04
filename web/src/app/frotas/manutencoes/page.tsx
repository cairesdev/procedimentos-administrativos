import { listMaintenances, listVehicles } from "@/features/fleet/queries";
import { MaintenanceForm } from "@/features/fleet/components/MaintenanceForm";
import { MaintenanceTable } from "@/features/fleet/components/MaintenanceTable";
import { listTemplates } from "@/features/documents/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";

type MaintenancesPageProps = {
  searchParams: Promise<{ veiculo?: string; abertas?: string; pagina?: string }>;
};

export default async function MaintenancesPage({ searchParams }: MaintenancesPageProps) {
  const viewer = await requirePermission("fleet:read", "FROTAS");
  const { veiculo, abertas, pagina } = await searchParams;

  const [maintenances, vehicles, modelos] = await Promise.all([
    listMaintenances({
      veiculo,
      abertas: abertas === "" || abertas === undefined ? undefined : abertas === "true",
      pagina,
    }),
    listVehicles(),
    listTemplates("FROTAS").catch(() => []),
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

      <FilterBar base="/frotas/manutencoes" ativo={Boolean(veiculo || abertas)}>
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

        <FilterField label="Situação" htmlFor="abertas">
          <select id="abertas" name="abertas" defaultValue={abertas ?? ""}>
            <option value="">Abertas e concluídas</option>
            <option value="true">Só as abertas</option>
            <option value="false">Só as concluídas</option>
          </select>
        </FilterField>
      </FilterBar>

      <Card title={`${maintenances.total} registros`} padded={false}>
        <MaintenanceTable
          maintenances={maintenances.itens}
          canWrite={canWrite}
          canIssue={viewer.can("documents:issue")}
          modelos={modelos}
        />
        <Pagination
          info={maintenances}
          base="/frotas/manutencoes"
          filtros={{ veiculo, abertas }}
        />
      </Card>
    </>
  );
}
