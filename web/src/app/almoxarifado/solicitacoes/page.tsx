import Link from "next/link";
import { listStockRequests, listWarehouses } from "@/features/stock/queries";
import { RequestTable } from "@/features/stock/components/RequestTable";
import { REQUEST_STATUSES } from "@/features/stock/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { Pagination } from "@/shared/ui/Pagination";

type RequestsPageProps = {
  searchParams: Promise<{ status?: string; almoxarifado?: string; pagina?: string }>;
};

export default async function StockRequestsPage({ searchParams }: RequestsPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { status, almoxarifado, pagina } = await searchParams;

  const [requests, warehouses, aguardando] = await Promise.all([
    listStockRequests({ status, almoxarifado, pagina }),
    listWarehouses(),
    // Só pelo total: o aviso fala da fila inteira, não da página atual.
    listStockRequests({ status: "SOLICITADA" }),
  ]);

  const pendentes = aguardando.total;

  return (
    <>
      <PageHeader
        title="Pedidos"
        subtitle="A unidade pede, o almoxarifado libera, a unidade confirma o que chegou"
        action={
          viewer.can("stock:request") ? (
            <Link href="/almoxarifado/solicitacoes/nova">
              <Button type="button">Novo pedido</Button>
            </Link>
          ) : null
        }
      />

      {pendentes > 0 && viewer.can("stock:manage") ? (
        <Alert tone="info">
          {pendentes === 1
            ? "Um pedido aguardando liberação."
            : `${pendentes} pedidos aguardando liberação.`}{" "}
          Enquanto isso, o saldo deles fica reservado.{" "}
          {/* O aviso leva à fila: a liberação acontece dentro de cada pedido,
              e sem este atalho o caminho até ela é adivinhar o filtro. */}
          <Link href="/almoxarifado/solicitacoes?status=SOLICITADA">Ver a fila de liberação</Link>
        </Alert>
      ) : null}

      <FilterBar base="/almoxarifado/solicitacoes" ativo={Boolean(status || almoxarifado)}>
        <FilterField label="Situação" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Todas as situações</option>
            {REQUEST_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Almoxarifado" htmlFor="almoxarifado">
          <select id="almoxarifado" name="almoxarifado" defaultValue={almoxarifado ?? ""}>
            <option value="">Todos os almoxarifados</option>
            {warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Card title={`${requests.total} pedidos`} padded={false}>
        <RequestTable requests={requests.itens} />
        <Pagination
          info={requests}
          base="/almoxarifado/solicitacoes"
          filtros={{ status, almoxarifado }}
        />
      </Card>
    </>
  );
}
