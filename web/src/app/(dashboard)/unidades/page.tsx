import { listUnits } from "@/features/units/queries";
import { UnitForm } from "@/features/units/components/UnitForm";
import { UnitTable } from "@/features/units/components/UnitTable";
import { Card, Columns, PageHeader } from "@/shared/ui/layout";

export default async function UnitsPage() {
  const units = await listUnits();

  return (
    <>
      <PageHeader
        title="Unidades"
        subtitle="Secretarias que recebem contratos e criam solicitações"
      />

      <Columns>
        <Card title={`${units.length} cadastradas`} padded={false}>
          <UnitTable units={units} />
        </Card>

        <Card title="Nova unidade">
          <UnitForm />
        </Card>
      </Columns>
    </>
  );
}
