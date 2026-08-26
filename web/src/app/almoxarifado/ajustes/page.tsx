import { getLocalStock, listAdjustments, listStockLocations } from "@/features/stock/queries";
import { AdjustmentForm } from "@/features/stock/components/AdjustmentForm";
import { ADJUSTMENT_REASONS } from "@/features/stock/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Badge, Card, PageHeader, Table, Toolbar, numericCell } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { Pagination } from "@/shared/ui/Pagination";

type AdjustmentsPageProps = {
  searchParams: Promise<{ local?: string; pagina?: string }>;
};

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

export default async function AdjustmentsPage({ searchParams }: AdjustmentsPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { local, pagina } = await searchParams;

  const locais = await listStockLocations();
  const escolhido = local ?? locais[0]?.id;

  const [ajustes, estoque] = await Promise.all([
    listAdjustments({ local, pagina }),
    escolhido ? getLocalStock(escolhido) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Ajustes de estoque"
        subtitle="Contagem física que não bate com o sistema — sempre com motivo"
        action={
          escolhido && viewer.can("stock:receive") ? (
            <ModalTrigger
              label="Ajustar"
              title="Ajustar saldo"
              description="Informe o saldo contado; o sistema calcula a diferença."
            >
              <AdjustmentForm estoque={estoque} />
            </ModalTrigger>
          ) : null
        }
      />

      <Alert tone="info">
        O ajuste existe para o resto do módulo não precisar mentir: sem ele, quem perdeu material
        lançaria um consumo falso e o relatório de consumo viraria ficção.
      </Alert>

      <form method="get">
        <Toolbar>
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

      <Card title={`${ajustes.total} ajustes`} padded={false}>
        <Table
          columns={["Produto", "Onde", "Antes", "Depois", "Diferença", "Motivo", "Quando"]}
          isEmpty={ajustes.itens.length === 0}
          emptyMessage="Nenhum ajuste registrado."
        >
          {ajustes.itens.map((ajuste) => (
            <tr key={ajuste.id}>
              <td>
                <strong>{ajuste.produtoNome}</strong>
                <br />
                <small>{ajuste.unidadeMedida}</small>
              </td>
              <td>{ajuste.onde}</td>
              <td className={numericCell}>{formatar(ajuste.saldoAnterior)}</td>
              <td className={numericCell}>{formatar(ajuste.saldoCorrigido)}</td>
              <td className={numericCell}>
                <Badge tone={ajuste.diferenca < 0 ? "warning" : "success"}>
                  {ajuste.diferenca > 0 ? "+" : ""}
                  {formatar(ajuste.diferenca)}
                </Badge>
              </td>
              <td>
                {ADJUSTMENT_REASONS.find((m) => m.value === ajuste.motivo)?.label ?? ajuste.motivo}
                {ajuste.observacao ? (
                  <>
                    <br />
                    <small>{ajuste.observacao}</small>
                  </>
                ) : null}
              </td>
              <td>
                {toDate(ajuste.data)}
                <br />
                <small>por {ajuste.usuarioNome}</small>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination info={ajustes} base="/almoxarifado/ajustes" filtros={{ local }} />
      </Card>
    </>
  );
}
