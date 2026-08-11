import { listSuppliers } from "@/features/suppliers/queries";
import { SupplierForm } from "@/features/suppliers/components/SupplierForm";
import { SupplierTable } from "@/features/suppliers/components/SupplierTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function SuppliersPage() {
  const viewer = await requirePermission("suppliers:read");
  const suppliers = await listSuppliers();

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro global, compartilhado entre as prefeituras"
        action={
          viewer.can("suppliers:write") ? (
            <ModalTrigger
              label="Novo fornecedor"
              title="Novo fornecedor"
              description="Alterações neste cadastro valem para todas as prefeituras e ficam registradas em histórico."
            >
              <SupplierForm />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${suppliers.length} encontrados`} padded={false}>
        <SupplierTable suppliers={suppliers} canWrite={viewer.can("suppliers:write")} />
      </Card>
    </>
  );
}
