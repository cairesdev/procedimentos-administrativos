import { listSectors } from "@/features/sectors/queries";
import { DepartmentForm } from "@/features/sectors/components/DepartmentForm";
import { SectorForm } from "@/features/sectors/components/SectorForm";
import { SectorTable } from "@/features/sectors/components/SectorTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function SectorsPage() {
  const viewer = await requirePermission("sectors:read");
  const sectors = await listSectors();

  return (
    <>
      <PageHeader
        title="Setores"
        subtitle="Quem processa: protocolo, compras, controladoria e demais setores funcionais"
        action={
          viewer.can("sectors:write") ? (
            <Toolbar>
              <ModalTrigger
                label="Novo departamento"
                title="Novo departamento"
                description="Departamento pode ser destino direto de uma etapa do fluxo."
              >
                <DepartmentForm sectors={sectors} />
              </ModalTrigger>
              <ModalTrigger label="Novo setor" title="Novo setor">
                <SectorForm />
              </ModalTrigger>
            </Toolbar>
          ) : null
        }
      />

      <Card title={`${sectors.length} cadastrados`} padded={false}>
        <SectorTable sectors={sectors} canWrite={viewer.can("sectors:write")} />
      </Card>
    </>
  );
}
