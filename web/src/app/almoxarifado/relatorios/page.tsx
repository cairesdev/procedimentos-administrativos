import Link from "next/link";
import {
  listConsumptionReports, listStockTypes, listWarehouses,
} from "@/features/stock/queries";
import { ConsumptionReportForm } from "@/features/stock/components/ConsumptionReportForm";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Table } from "@/shared/ui/layout";
import { toDate, toDateTime } from "@/shared/ui/labels";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function ConsumptionReportsPage() {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");

  const [relatorios, almoxarifados, tipos] = await Promise.all([
    listConsumptionReports(),
    listWarehouses(),
    listStockTypes(),
  ]);

  const podeGerar = viewer.can("stock:manage");

  return (
    <>
      <PageHeader
        title="Relatório de consumo"
        subtitle="O que cada unidade recebeu, consumiu, perdeu e devolveu no período"
        action={
          podeGerar ? (
            <ModalTrigger
              label="Gerar relatório"
              title="Gerar relatório de consumo"
              description="O recorte fica salvo; os números são apurados toda vez que você abre."
            >
              <ConsumptionReportForm almoxarifados={almoxarifados} tipos={tipos} />
            </ModalTrigger>
          ) : null
        }
      />

      <Alert tone="info">
        Tudo em quantidade. O almoxarifado registra o que entra sem preço, então este relatório
        não tem valor em reais — para a prestação de contas financeira do FNDE, use as notas
        fiscais das entradas.
      </Alert>

      <Card title={`${relatorios.length} relatórios`} padded={false}>
        <Table
          columns={["Período", "Almoxarifado", "Tipo", "Gerado por", "Quando", ""]}
          isEmpty={relatorios.length === 0}
          emptyMessage="Nenhum relatório gerado ainda."
        >
          {relatorios.map((relatorio) => (
            <tr key={relatorio.id}>
              <td>
                {toDate(relatorio.periodoInicio)} a {toDate(relatorio.periodoFim)}
              </td>
              <td>{relatorio.almoxarifadoNome}</td>
              <td>{relatorio.tipoEstoqueNome ?? "todos"}</td>
              <td>{relatorio.criadoPorNome ?? "—"}</td>
              <td>{toDateTime(relatorio.criadoEm)}</td>
              <td style={{ textAlign: "right" }}>
                <Link href={`/almoxarifado/relatorios/${relatorio.id}`}>
                  <Button type="button" variant="ghost">
                    Abrir
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
