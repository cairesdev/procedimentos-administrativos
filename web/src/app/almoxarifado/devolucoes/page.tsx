import { getLocalStock, listReturns, listStockLocations } from "@/features/stock/queries";
import { ReturnForm } from "@/features/stock/components/ReturnForm";
import { ReturnTable } from "@/features/stock/components/ReturnTable";
import { RETURN_STATUSES } from "@/features/stock/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";

type ReturnsPageProps = {
  searchParams: Promise<{ status?: string; local?: string; pagina?: string }>;
};

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { status, local, pagina } = await searchParams;

  const locais = await listStockLocations();
  const escolhido = local ?? locais[0]?.id;

  const [devolucoes, estoque, pendentes] = await Promise.all([
    listReturns({ status, local, pagina }),
    escolhido ? getLocalStock(escolhido) : Promise.resolve([]),
    // Só pelo total: o aviso fala da fila inteira, não da página atual.
    listReturns({ status: "PENDENTE" }),
  ]);

  const podeResponder = viewer.can("stock:manage");

  return (
    <>
      <PageHeader
        title="Devoluções"
        subtitle="O material só volta ao saldo do almoxarifado depois do aceite"
        action={
          escolhido && viewer.can("stock:receive") ? (
            <ModalTrigger
              label="Devolver material"
              title="Devolver material"
              description="A escolha é por lote — é ele que carrega a validade."
            >
              <ReturnForm estoque={estoque} />
            </ModalTrigger>
          ) : null
        }
      />

      {pendentes.total > 0 && podeResponder ? (
        <Alert tone="info">
          {pendentes.total === 1
            ? "Uma devolução aguardando aceite."
            : `${pendentes.total} devoluções aguardando aceite.`}{" "}
          Até a resposta, o material não está em nenhum dos dois saldos.
        </Alert>
      ) : null}

      <form method="get">
        <Toolbar>
          <select name="status" defaultValue={status ?? ""} aria-label="Situação">
            <option value="">Todas as situações</option>
            {RETURN_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select name="local" defaultValue={local ?? ""} aria-label="Local">
            <option value="">Todos os locais</option>
            {locais.map((item) => (
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

      <Card title={`${devolucoes.total} devoluções`} padded={false}>
        <ReturnTable devolucoes={devolucoes.itens} podeResponder={podeResponder} />
        <Pagination
          info={devolucoes}
          base="/almoxarifado/devolucoes"
          filtros={{ status, local }}
        />
      </Card>
    </>
  );
}
