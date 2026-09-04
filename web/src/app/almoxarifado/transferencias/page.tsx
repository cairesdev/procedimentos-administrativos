import { listTransfers, listWarehouses } from "@/features/stock/queries";
import { TransferForm } from "@/features/stock/components/TransferForm";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader, Table, numericCell } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { Pagination } from "@/shared/ui/Pagination";

type TransfersPageProps = {
  searchParams: Promise<{ almoxarifado?: string; pagina?: string }>;
};

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

export default async function StockTransfersPage({ searchParams }: TransfersPageProps) {
  const viewer = await requirePermission("stock:manage", "ALMOXARIFADO");
  const { almoxarifado, pagina } = await searchParams;

  const [transferencias, almoxarifados] = await Promise.all([
    listTransfers({ almoxarifado, pagina }),
    listWarehouses(),
  ]);

  return (
    <>
      <PageHeader
        title="Transferências"
        subtitle="Material entre almoxarifados — o destino recebe como uma entrada"
        action={
          viewer.can("stock:manage") ? (
            <ModalTrigger
              label="Transferir"
              title="Transferir entre almoxarifados"
              description="A validade é preservada e o rastro de origem fica no lote."
            >
              <TransferForm almoxarifados={almoxarifados} />
            </ModalTrigger>
          ) : null
        }
      />

      {almoxarifados.filter((item) => item.ativo).length < 2 ? (
        <Alert tone="info">
          Transferência exige ao menos dois almoxarifados ativos.
        </Alert>
      ) : null}

      <FilterBar base="/almoxarifado/transferencias" ativo={Boolean(almoxarifado)}>
        <FilterField label="Almoxarifado" htmlFor="almoxarifado">
          <select id="almoxarifado" name="almoxarifado" defaultValue={almoxarifado ?? ""}>
            <option value="">Todos os almoxarifados</option>
            {almoxarifados.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Card title={`${transferencias.total} transferências`} padded={false}>
        <Table
          columns={["Produto", "Quantidade", "De", "Para", "Motivo", "Quando"]}
          isEmpty={transferencias.itens.length === 0}
          emptyMessage="Nenhuma transferência registrada."
        >
          {transferencias.itens.map((transferencia) => (
            <tr key={transferencia.id}>
              <td>
                <strong>{transferencia.produtoNome}</strong>
                <br />
                <small>
                  {transferencia.dataValidade
                    ? `vence ${toDate(transferencia.dataValidade)}`
                    : "sem validade"}
                </small>
              </td>
              <td className={numericCell}>
                {formatar(transferencia.quantidade)} {transferencia.unidadeMedida}
              </td>
              <td>{transferencia.origemNome}</td>
              <td>{transferencia.destinoNome}</td>
              <td>{transferencia.motivo ?? "—"}</td>
              <td>
                {toDate(transferencia.data)}
                <br />
                <small>por {transferencia.usuarioNome}</small>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination
          info={transferencias}
          base="/almoxarifado/transferencias"
          filtros={{ almoxarifado }}
        />
      </Card>
    </>
  );
}
