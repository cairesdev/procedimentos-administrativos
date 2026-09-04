import Link from "next/link";
import { listIntakes, listStockTypes, listWarehouses } from "@/features/stock/queries";
import { IntakeTable } from "@/features/stock/components/IntakeTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { Pagination } from "@/shared/ui/Pagination";

type IntakesPageProps = {
  searchParams: Promise<{ almoxarifado?: string; tipo?: string; busca?: string; pagina?: string }>;
};

export default async function IntakesPage({ searchParams }: IntakesPageProps) {
  const viewer = await requirePermission("stock:manage", "ALMOXARIFADO");
  const { almoxarifado, tipo, busca, pagina } = await searchParams;

  const [intakes, warehouses, types] = await Promise.all([
    listIntakes({ almoxarifado, tipo, busca, pagina }),
    listWarehouses(),
    listStockTypes(),
  ]);

  return (
    <>
      <PageHeader
        title="Entradas"
        subtitle="O que chegou ao almoxarifado, com os lotes de cada remessa"
        action={
          viewer.can("stock:manage") ? (
            <Link href="/almoxarifado/entradas/nova">
              <Button type="button">Nova entrada</Button>
            </Link>
          ) : null
        }
      />

      <FilterBar base="/almoxarifado/entradas" ativo={Boolean(almoxarifado || tipo || busca)}>
        <FilterField label="Procurar" htmlFor="busca" largo>
          <input
            id="busca"
            name="busca"
            type="search"
            defaultValue={busca ?? ""}
            placeholder="Código ou título"
          />
        </FilterField>

        <FilterField label="Almoxarifado" htmlFor="almoxarifado">
          <select id="almoxarifado" name="almoxarifado" defaultValue={almoxarifado ?? ""}>
            <option value="">Todos</option>
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Tipo de estoque" htmlFor="tipo">
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""}>
            <option value="">Todos</option>
            {types.map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Card title={`${intakes.total} entradas`} padded={false}>
        <IntakeTable intakes={intakes.itens} />
        <Pagination
          info={intakes}
          base="/almoxarifado/entradas"
          filtros={{ almoxarifado, tipo, busca }}
        />
      </Card>
    </>
  );
}
