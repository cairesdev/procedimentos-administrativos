import { listVehicles } from "@/features/fleet/queries";
import { VehicleForm } from "@/features/fleet/components/VehicleForm";
import { VehicleTable } from "@/features/fleet/components/VehicleTable";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function VehiclesPage() {
  const viewer = await requirePermission("fleet:read", "FROTAS");
  const [vehicles, units] = await Promise.all([listVehicles(), listUnits()]);

  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.nome }));
  const canWrite = viewer.can("fleet:write");

  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle="A frota da prefeitura, com hodômetro e disponibilidade"
        action={
          canWrite ? (
            <ModalTrigger label="Novo veículo" title="Novo veículo">
              <VehicleForm units={unitOptions} />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${vehicles.length} cadastrados`} padded={false}>
        <VehicleTable vehicles={vehicles} units={unitOptions} canWrite={canWrite} />
      </Card>
    </>
  );
}
