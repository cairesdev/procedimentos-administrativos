import { getLocalStock, listConsumption, listStockLocations } from "@/features/stock/queries";
import { ConsumptionForm } from "@/features/stock/components/ConsumptionForm";
import { CONSUMPTION_FORMS } from "@/features/stock/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Table, Toolbar, numericCell } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { Pagination } from "@/shared/ui/Pagination";

type ConsumptionPageProps = {
  searchParams: Promise<{ local?: string; de?: string; ate?: string; pagina?: string }>;
};

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

export default async function ConsumptionPage({ searchParams }: ConsumptionPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { local, de, ate, pagina } = await searchParams;

  const locais = await listStockLocations();
  const escolhido = local ?? locais[0]?.id;

  const [consumo, estoque] = await Promise.all([
    listConsumption({ local: escolhido, de, ate, pagina }),
    escolhido ? getLocalStock(escolhido) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Consumo"
        subtitle="O que a unidade usou — a baixa sai do lote que vence primeiro"
        action={
          escolhido && viewer.can("stock:receive") ? (
            <ModalTrigger
              label="Registrar consumo"
              title="Registrar consumo"
              description="Informe produto e quantidade; o sistema escolhe os lotes."
            >
              <ConsumptionForm localId={escolhido} estoque={estoque} />
            </ModalTrigger>
          ) : null
        }
      />

      {locais.length === 0 ? (
        <Alert tone="info">Nenhum local cadastrado ainda.</Alert>
      ) : (
        <>
          <form method="get">
            <Toolbar>
              <select name="local" defaultValue={escolhido ?? ""} aria-label="Local">
                {locais.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
              <input type="date" name="de" defaultValue={de ?? ""} aria-label="De" />
              <input type="date" name="ate" defaultValue={ate ?? ""} aria-label="Até" />
              <Button type="submit" variant="secondary">
                Filtrar
              </Button>
            </Toolbar>
          </form>

          <Card title={`${consumo.total} registros`} padded={false}>
            <Table
              columns={["Produto", "Quantidade", "Forma", "Lotes", "Quando", "Observação"]}
              isEmpty={consumo.itens.length === 0}
              emptyMessage="Nenhum consumo registrado com esses filtros."
            >
              {consumo.itens.map((registro) => (
                <tr key={registro.id}>
                  <td>
                    <strong>{registro.produtoNome}</strong>
                  </td>
                  <td className={numericCell}>
                    {formatar(registro.quantidade)} {registro.unidadeMedida}
                  </td>
                  <td>
                    {CONSUMPTION_FORMS.find((f) => f.value === registro.forma)?.label
                      ?? registro.forma}
                    {registro.periodoInicio ? (
                      <>
                        <br />
                        <small>
                          {toDate(registro.periodoInicio)} a {toDate(registro.periodoFim!)}
                        </small>
                      </>
                    ) : null}
                  </td>
                  <td>{registro.lotes}</td>
                  <td>
                    {toDate(registro.data)}
                    <br />
                    <small>por {registro.usuarioNome}</small>
                  </td>
                  <td>{registro.observacao ?? "—"}</td>
                </tr>
              ))}
            </Table>
            <Pagination
              info={consumo}
              base="/almoxarifado/consumo"
              filtros={{ local: escolhido, de, ate }}
            />
          </Card>
        </>
      )}
    </>
  );
}
