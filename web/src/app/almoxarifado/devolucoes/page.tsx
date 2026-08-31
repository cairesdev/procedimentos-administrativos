import { getLocalStock, listReturns, listStockLocations } from "@/features/stock/queries";
import { ReturnForm } from "@/features/stock/components/ReturnForm";
import { ReturnTable } from "@/features/stock/components/ReturnTable";
import { RETURN_STATUSES } from "@/features/stock/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";
import { TabNav } from "@/shared/ui/TabNav";

type ReturnsPageProps = {
  searchParams: Promise<{ status?: string; local?: string; pagina?: string; aba?: string }>;
};

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { status, local, pagina, aba } = await searchParams;

  /**
   * Duas abas, porque são dois trabalhos.
   *
   * O que espera resposta é fila — alguém precisa aceitar ou recusar, e cada
   * dia parado é material que não está em saldo nenhum. O resto é histórico,
   * que se consulta. Misturados, a fila sumia dentro da lista à medida que as
   * respondidas se acumulavam, e o único sinal era um aviso no topo.
   */
  const naFila = aba !== "respondidas";

  const locais = await listStockLocations();
  const escolhido = local ?? locais[0]?.id;

  const [devolucoes, estoque, pendentes] = await Promise.all([
    // Na fila o status é a própria aba; no histórico o filtro volta a valer.
    listReturns(naFila
      ? { status: "PENDENTE", local, pagina }
      : { status, local, pagina, respondidas: true }),
    escolhido ? getLocalStock(escolhido) : Promise.resolve([]),
    // Só pelo total: a aba conta a fila inteira, não a página atual.
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

      <TabNav
        tabs={[
          {
            rotulo: "Aguardando resposta",
            href: "/almoxarifado/devolucoes",
            ativa: naFila,
            contagem: pendentes.total,
          },
          {
            rotulo: "Respondidas",
            href: "/almoxarifado/devolucoes?aba=respondidas",
            ativa: !naFila,
          },
        ]}
      />

      {naFila && pendentes.total > 0 && podeResponder ? (
        <Alert tone="info">
          Até a resposta, o material não está em nenhum dos dois saldos: já saiu do armário da
          unidade e ainda não entrou no do almoxarifado.
        </Alert>
      ) : null}

      <form method="get">
        <Toolbar>
          {/* O status é a própria aba na fila; filtrar por ele só faz sentido
              no histórico, onde há mais de um. */}
          {naFila ? null : (
            <>
              <input type="hidden" name="aba" value="respondidas" />
              <select name="status" defaultValue={status ?? ""} aria-label="Situação">
                <option value="">Aceitas e recusadas</option>
                {RETURN_STATUSES.filter((item) => item.value !== "PENDENTE").map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </>
          )}

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

      <Card
        title={naFila
          ? `${devolucoes.total} aguardando resposta`
          : `${devolucoes.total} respondidas`}
        padded={false}
      >
        <ReturnTable
          devolucoes={devolucoes.itens}
          podeResponder={podeResponder}
          vazio={naFila
            ? "Nenhuma devolução esperando resposta."
            : "Nenhuma devolução respondida com esses filtros."}
        />
        <Pagination
          info={devolucoes}
          base="/almoxarifado/devolucoes"
          filtros={naFila ? { local } : { status, local, aba: "respondidas" }}
        />
      </Card>
    </>
  );
}
