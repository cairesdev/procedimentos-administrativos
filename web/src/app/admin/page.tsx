import { listTenants } from "@/features/system-admin/queries";
import { TenantForm } from "@/features/system-admin/components/TenantForm";
import { TenantTable } from "@/features/system-admin/components/TenantTable";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

// O detalhe de cada prefeitura virou página própria: carregar módulos, timbre,
// administradores e cadastros de TODAS as prefeituras nesta tela dava uma
// enxurrada de chamadas a cada abertura.
export default async function AdminHomePage() {
  const tenants = await listTenants();

  return (
    <>
      <PageHeader
        title="Prefeituras"
        subtitle="Clique em uma prefeitura para gerir módulos, administradores e cadastros"
        action={
          <ModalTrigger label="Nova prefeitura" title="Nova prefeitura">
            <TenantForm />
          </ModalTrigger>
        }
      />

      <Card title={`${tenants.length} cadastradas`} padded={false}>
        <TenantTable tenants={tenants} />
      </Card>
    </>
  );
}
