import { listSectors } from "@/features/sectors/queries";
import { DepartmentForm } from "@/features/sectors/components/DepartmentForm";
import { SectorForm } from "@/features/sectors/components/SectorForm";
import { SectorTable } from "@/features/sectors/components/SectorTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, Columns, PageHeader, Stack } from "@/shared/ui/layout";

export default async function SectorsPage() {
  const viewer = await requirePermission("sectors:read");
  const sectors = await listSectors();

  return (
    <>
      <PageHeader
        title="Setores"
        subtitle="Quem processa: protocolo, compras, controladoria e demais setores funcionais"
      />

      <Columns>
        <Card title={`${sectors.length} cadastrados`} padded={false}>
          <SectorTable sectors={sectors} />
        </Card>

        {viewer.can("sectors:write") ? (
          <Stack>
            <Card title="Novo setor">
              <SectorForm />
            </Card>
            <Card title="Novo departamento">
              <DepartmentForm sectors={sectors} />
            </Card>
          </Stack>
        ) : null}
      </Columns>
    </>
  );
}
