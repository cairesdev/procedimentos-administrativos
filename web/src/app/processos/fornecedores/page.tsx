import { listSuppliers } from "@/features/suppliers/queries";
import { SupplierForm } from "@/features/suppliers/components/SupplierForm";
import { SupplierTable } from "@/features/suppliers/components/SupplierTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";

type SuppliersPageProps = { searchParams: Promise<{ busca?: string; pagina?: string }> };

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const viewer = await requirePermission("suppliers:read");
  const { busca, pagina } = await searchParams;
  const suppliers = await listSuppliers(busca, pagina);

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

      {/* Busca por GET: some da URL ao limpar e volta para a página 1. */}
      <form method="get">
        <Toolbar>
          <input
            type="search"
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Razão social ou CNPJ"
            aria-label="Buscar fornecedor"
          />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </Toolbar>
      </form>

      <Card title={`${suppliers.total} encontrados`} padded={false}>
        <SupplierTable suppliers={suppliers.itens} canWrite={viewer.can("suppliers:write")} />
        <Pagination info={suppliers} base="/processos/fornecedores" filtros={{ busca }} />
      </Card>
    </>
  );
}
