import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { findPriceRecord } from "@/features/price-records/queries";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { toCurrency, toDate } from "@/shared/ui/labels";
import { Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";

type PriceRecordPageProps = { params: Promise<{ id: string }> };

const quantidade = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

export default async function PriceRecordDetailPage({ params }: PriceRecordPageProps) {
  await requirePermission("bids:read", "PROCESSOS");
  const { id } = await params;

  const ata = await findPriceRecord(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const hoje = new Date();
  const vencida = new Date(ata.dataVigencia) < hoje;
  const contratado = ata.contratos.reduce((soma, contrato) => soma + contrato.valorTotal, 0);

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/processos/atas"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Atas de registro
        </Link>
      </p>

      <PageHeader
        title={`Ata ${ata.numero}`}
        subtitle="Registro de preços — origem alternativa à licitação para firmar contrato"
        action={vencida ? <Badge tone="warning">vigência vencida</Badge> : null}
      />

      <Stack>
        <Card title="Dados da ata">
          <SummaryGrid
            items={[
              { label: "Assinatura", value: toDate(ata.dataAssinatura) },
              { label: "Vigência até", value: toDate(ata.dataVigencia) },
              { label: "Valor registrado", value: toCurrency(ata.valorTotal) },
              { label: "Valor já contratado", value: toCurrency(contratado) },
              {
                label: "Licitação de origem",
                value: ata.licitacaoId ? (
                  <Link href={`/processos/licitacoes/${ata.licitacaoId}`} style={{ color: "var(--acao)" }}>
                    {ata.licitacaoNumero}
                  </Link>
                ) : (
                  "—"
                ),
              },
              { label: "Objeto", value: ata.objeto, wide: true },
            ]}
          />
        </Card>

        {vencida ? (
          <Alert tone="info">
            Ata vencida não origina contrato novo. Os contratos já firmados a partir dela seguem
            valendo pela vigência própria de cada um.
          </Alert>
        ) : null}

        <Card title={`Itens registrados (${ata.itens.length})`} padded={false}>
          <Table
            columns={["Produto", "Marca", "Quantidade", "Valor unitário", "Valor total"]}
            isEmpty={ata.itens.length === 0}
            emptyMessage="Nenhum item registrado nesta ata."
          >
            {ata.itens.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.produto}</strong>
                  {item.descricao ? (
                    <>
                      <br />
                      <small>{item.descricao}</small>
                    </>
                  ) : null}
                </td>
                <td>{item.marca ?? "—"}</td>
                <td className={numericCell}>
                  {quantidade(item.quantidade)} {item.unidadeMedida}
                </td>
                <td className={numericCell}>{toCurrency(item.valorUnitario)}</td>
                <td className={numericCell}>{toCurrency(item.valorTotal)}</td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card title={`Contratos firmados (${ata.contratos.length})`} padded={false}>
          <Table
            columns={["Contrato", "Fornecedor", "Vigência", "Valor"]}
            isEmpty={ata.contratos.length === 0}
            emptyMessage="Nenhum contrato firmado a partir desta ata."
          >
            {ata.contratos.map((contrato) => {
              const contratoVencido = contrato.dataFim ? new Date(contrato.dataFim) < hoje : false;
              return (
                <tr key={contrato.id}>
                  <td>
                    <Link href={`/processos/contratos/${contrato.id}`} style={{ color: "var(--acao)" }}>
                      {contrato.numero}
                    </Link>
                  </td>
                  <td>{contrato.fornecedorRazaoSocial}</td>
                  <td>
                    {toDate(contrato.dataInicio)} a{" "}
                    {contrato.dataFim ? toDate(contrato.dataFim) : "sem termo"}
                    {contratoVencido ? (
                      <>
                        {" "}
                        <Badge tone="warning">vencido</Badge>
                      </>
                    ) : null}
                  </td>
                  <td className={numericCell}>{toCurrency(contrato.valorTotal)}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </Stack>
    </>
  );
}
