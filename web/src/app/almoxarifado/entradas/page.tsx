import Link from "next/link";
import { listIntakes, listStockTypes, listWarehouses } from "@/features/stock/queries";
import { IntakeTable } from "@/features/stock/components/IntakeTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader, Toolbar } from "@/shared/ui/layout";
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

      {/* Formulário GET: o filtro fica na URL e sobrevive ao recarregar. */}
      <form method="get">
        <Toolbar>
          <input
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Código ou título"
            aria-label="Buscar remessa"
          />

          <select name="almoxarifado" defaultValue={almoxarifado ?? ""} aria-label="Almoxarifado">
            <option value="">Todos os almoxarifados</option>
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>

          <select name="tipo" defaultValue={tipo ?? ""} aria-label="Tipo de estoque">
            <option value="">Todos os tipos</option>
            {types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>

          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </Toolbar>
      </form>

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
