import { listUnits } from "@/features/units/queries";
import { UnitForm } from "@/features/units/components/UnitForm";
import { UnitTable } from "@/features/units/components/UnitTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function UnitsPage() {
  const viewer = await requirePermission("units:read");
  const units = await listUnits();

  return (
    <>
      <PageHeader
        title="Unidades"
        subtitle="Secretarias que recebem contratos e criam solicitações"
        action={
          viewer.can("units:write") ? (
            <ModalTrigger label="Nova unidade" title="Nova unidade">
              <UnitForm />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${units.length} cadastradas`} padded={false}>
        <UnitTable units={units} canWrite={viewer.can("units:write")} />
      </Card>
    </>
  );
}
