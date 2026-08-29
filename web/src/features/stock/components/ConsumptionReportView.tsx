import { Alert, Card, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";
import { toDocument } from "@/shared/ui/labels";
import type { ConsumptionReportDetail } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

const somar = (valores: number[]) =>
  Math.round(valores.reduce((total, valor) => total + valor, 0) * 1000) / 1000;

/**
 * O apurado, do jeito que vai ao conselho de alimentação escolar.
 *
 * Duas leituras da mesma coisa: por unidade — que responde "onde foi parar" —
 * e por produto, que responde "quanto de arroz o município consumiu".
 */
export const ConsumptionReportView = ({
  relatorio,
}: {
  relatorio: ConsumptionReportDetail;
}) => {
  const { unidades, produtos } = relatorio;

  const percentual = relatorio.entradasTotal === 0
    ? "0%"
    : `${(Math.round((relatorio.entradasAgriculturaFamiliar / relatorio.entradasTotal) * 1000) / 10)
      .toString().replace(".", ",")}%`;

  return (
    <>
      <Card>
        <SummaryGrid
          items={[
            { label: "Unidades atendidas", value: unidades.length },
            { label: "Recebido", value: formatar(somar(produtos.map((p) => p.recebido))) },
            { label: "Consumido", value: formatar(somar(produtos.map((p) => p.consumido))) },
            { label: "Perdido", value: formatar(somar(produtos.map((p) => p.perdido))) },
            { label: "Devolvido", value: formatar(somar(produtos.map((p) => p.devolvido))) },
          ]}
        />
      </Card>

      {unidades.length === 0 ? (
        <Alert tone="info">
          Nenhum movimento neste período. Confira as datas — o recebimento entra pela data em que a
          unidade confirmou, não pela data em que o almoxarifado despachou.
        </Alert>
      ) : null}

      <Card title="Por unidade" padded={false}>
        <Table
          columns={["Unidade", "Recebido", "Consumido", "Perdido", "Devolvido", "Saldo hoje"]}
          isEmpty={unidades.length === 0}
          emptyMessage="Nenhuma unidade movimentou material no período."
        >
          {unidades.map((unidade) => (
            <tr key={unidade.localId}>
              <td>
                <strong>{unidade.nome}</strong>
                {unidade.cnpj ? (
                  <>
                    <br />
                    <small>{toDocument(unidade.cnpj)}</small>
                  </>
                ) : null}
              </td>
              <td className={numericCell}>{formatar(unidade.recebido)}</td>
              <td className={numericCell}>{formatar(unidade.consumido)}</td>
              <td className={numericCell}>{formatar(unidade.perdido)}</td>
              <td className={numericCell}>{formatar(unidade.devolvido)}</td>
              <td className={numericCell}>{formatar(unidade.saldo)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Por produto" padded={false}>
        <Table
          columns={["Produto", "Unid.", "Recebido", "Consumido", "Perdido", "Devolvido"]}
          isEmpty={produtos.length === 0}
          emptyMessage="Nenhum produto movimentado no período."
        >
          {produtos.map((produto) => (
            <tr key={produto.produtoId}>
              <td>{produto.nome}</td>
              <td>{produto.unidadeMedida}</td>
              <td className={numericCell}>{formatar(produto.recebido)}</td>
              <td className={numericCell}>{formatar(produto.consumido)}</td>
              <td className={numericCell}>{formatar(produto.perdido)}</td>
              <td className={numericCell}>{formatar(produto.devolvido)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Agricultura familiar">
        <p style={{ margin: "0 0 8px" }}>
          <strong>{percentual}</strong> das remessas que entraram no período vieram de fornecedor
          cadastrado como agricultura familiar — {relatorio.entradasAgriculturaFamiliar} de{" "}
          {relatorio.entradasTotal}.
        </p>
        <Alert tone="info">
          O percentual é por número de remessas, não por valor: o almoxarifado registra quantidade
          e não guarda preço. Os 30% que o FNDE cobra são financeiros — para chegar neles, cruze
          com o valor das notas fiscais.
        </Alert>
      </Card>
    </>
  );
};
