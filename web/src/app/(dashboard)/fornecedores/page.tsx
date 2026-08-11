import { listSuppliers } from "@/features/suppliers/queries";
import { SupplierForm } from "@/features/suppliers/components/SupplierForm";
import { SupplierTable } from "@/features/suppliers/components/SupplierTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, Columns, PageHeader } from "@/shared/ui/layout";

export default async function SuppliersPage() {
  const viewer = await requirePermission("suppliers:read");
  const suppliers = await listSuppliers();

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro global, compartilhado entre as prefeituras"
      />

      <Columns>
        <Card title={`${suppliers.length} encontrados`} padded={false}>
          <SupplierTable suppliers={suppliers} />
        </Card>

        {viewer.can("suppliers:write") ? (
          <Card title="Novo fornecedor">
            <SupplierForm />
          </Card>
        ) : null}
      </Columns>
    </>
  );
}
