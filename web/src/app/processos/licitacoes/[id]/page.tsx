import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { findBid } from "@/features/bids/queries";
import { bidModalityLabel } from "@/features/bids/types";
import { Apresentacao } from "@/features/contracts/components/Apresentacao";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { toCurrency, toDate } from "@/shared/ui/labels";
import {
  Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table, numericCell,
} from "@/shared/ui/layout";

type BidPageProps = { params: Promise<{ id: string }> };

export default async function BidDetailPage({ params }: BidPageProps) {
  await requirePermission("bids:read", "PROCESSOS");
  const { id } = await params;

  const licitacao = await findBid(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const hoje = new Date();
  const contratado = licitacao.contratos.reduce((soma, contrato) => soma + contrato.valorTotal, 0);
  /**
   * O que ainda cabe.
   *
   * Deixou de ser informação e virou regra: a API recusa contrato que faça a
   * soma passar do valor licitado. A tela mostra o número antes de alguém
   * tentar.
   */
  const disponivel = Math.round((licitacao.valorTotal - contratado) * 100) / 100;

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/processos/licitacoes"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Licitações
        </Link>
      </p>

      <PageHeader
        title={`Licitação ${licitacao.numero}`}
        subtitle={bidModalityLabel(licitacao.modalidade)}
      />

      <Stack>
        <Apresentacao
          procedimento={{
            rotulo: "Licitação",
            numero: licitacao.numero,
            modalidade: licitacao.modalidade,
            objeto: licitacao.objeto,
            valor: licitacao.valorTotal,
            data: licitacao.dataAssinatura,
          }}
        />

        <Card title="Execução">
          <SummaryGrid
            items={[
              { label: "Valor licitado", value: toCurrency(licitacao.valorTotal) },
              { label: "Já contratado", value: toCurrency(contratado) },
              {
                label: "Ainda cabe",
                value: toCurrency(disponivel),
              },
              ...(licitacao.resumo
                ? [{ label: "Resumo", value: licitacao.resumo, wide: true }]
                : []),
            ]}
          />
        </Card>

        {disponivel <= 0 ? (
          <Alert tone="info">
            O valor licitado já foi todo contratado. Contrato novo a partir desta licitação será
            recusado enquanto o valor não for revisto.
          </Alert>
        ) : null}

        <Card title={`Atas de registro de preços (${licitacao.atas.length})`} padded={false}>
          <Table
            columns={["Número", "Vigência até", "Valor", "Contratos gerados"]}
            isEmpty={licitacao.atas.length === 0}
            emptyMessage="Esta licitação não gerou ata de registro de preços."
          >
            {licitacao.atas.map((ata) => {
              const vencida = new Date(ata.dataVigencia) < hoje;
              return (
                <tr key={ata.id}>
                  <td>
                    <Link href={`/processos/atas/${ata.id}`} style={{ color: "var(--acao)" }}>
                      {ata.numero}
                    </Link>
                  </td>
                  <td>
                    {toDate(ata.dataVigencia)}
                    {vencida ? (
                      <>
                        {" "}
                        <Badge tone="warning">vencida</Badge>
                      </>
                    ) : null}
                  </td>
                  <td className={numericCell}>{toCurrency(ata.valorTotal)}</td>
                  <td className={numericCell}>{ata.contratos}</td>
                </tr>
              );
            })}
          </Table>
        </Card>

        {/* Contratos diretos e os que vieram por ata — a licitação responde por todos. */}
        <Card title={`Contratos vinculados (${licitacao.contratos.length})`} padded={false}>
          <Table
            columns={["Contrato", "Fornecedor", "Vigência", "Origem", "Valor"]}
            isEmpty={licitacao.contratos.length === 0}
            emptyMessage="Nenhum contrato firmado a partir desta licitação."
          >
            {licitacao.contratos.map((contrato) => {
              const vencido = contrato.dataFim ? new Date(contrato.dataFim) < hoje : false;
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
                    {vencido ? (
                      <>
                        {" "}
                        <Badge tone="warning">vencido</Badge>
                      </>
                    ) : null}
                  </td>
                  <td>{contrato.viaAta ? `Ata ${contrato.viaAta}` : "Direto da licitação"}</td>
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
