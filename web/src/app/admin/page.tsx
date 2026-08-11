import { listTenants } from "@/features/system-admin/queries";
import { TenantForm } from "@/features/system-admin/components/TenantForm";
import { TenantTable } from "@/features/system-admin/components/TenantTable";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { TenantSettings } from "@/features/system-admin/components/TenantSettings";

export default async function AdminHomePage() {
  const tenants = await listTenants();

  return (
    <>
      <PageHeader
        title="Prefeituras"
        subtitle="Cadastro de tenants, módulos habilitados e configuração de documentos"
        action={
          <ModalTrigger label="Nova prefeitura" title="Nova prefeitura">
            <TenantForm />
          </ModalTrigger>
        }
      />

      <Card title={`${tenants.length} cadastradas`} padded={false}>
        <TenantTable tenants={tenants} />
      </Card>

      <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
        {tenants.map((tenant) => (
          <TenantSettings key={tenant.id} tenant={tenant} />
        ))}
      </div>
    </>
  );
}
