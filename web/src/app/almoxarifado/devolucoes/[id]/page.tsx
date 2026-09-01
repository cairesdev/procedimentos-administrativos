import { notFound } from "next/navigation";
import { getReturn } from "@/features/stock/queries";
import { RETURN_STATUSES } from "@/features/stock/types";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import type { DocumentTemplate, IssuedDocument } from "@/features/documents/types";
import { lista } from "@/shared/api/colecao";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Badge, Card, PageHeader, SummaryGrid } from "@/shared/ui/layout";
import { toDate, toDateTime } from "@/shared/ui/labels";

type ReturnPageProps = { params: Promise<{ id: string }> };

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Uma devolução, com o comprovante.
 *
 * Era a única movimentação do almoxarifado sem peça emitida. A escola devolve,
 * o saldo sai do armário dela na hora, e até aqui não havia papel dizendo isso
 * — nem quando o almoxarifado recusava.
 */
export default async function ReturnPage({ params }: ReturnPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { id } = await params;

  const devolucao = await getReturn(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  // 200 com corpo vazio é 404 disfarçado: sem isto, a primeira leitura de
  // `devolucao.produtoNome` derruba a página com um erro que não explica nada.
  if (!devolucao?.id) notFound();

  const [modelos, emitidos] = await Promise.all([
    listTemplates("ALMOXARIFADO").then(lista<DocumentTemplate>).catch(() => []),
    listDocumentsFor(id).then(lista<IssuedDocument>).catch(() => []),
  ]);

  const estado = RETURN_STATUSES.find((item) => item.value === devolucao.status)
    ?? { label: devolucao.status?.toLowerCase() ?? "—", tone: "neutral" as const };

  return (
    <>
      <PageHeader
        title={`Devolução · ${devolucao.produtoNome}`}
        subtitle={`${devolucao.localNome} → ${devolucao.almoxarifadoNome}`}
      />

      {devolucao.status === "PENDENTE" ? (
        <Alert tone="info">
          O material já saiu do armário da unidade e ainda não entrou no saldo do almoxarifado.
          Enquanto isso, ele não pode ser consumido nem devolvido de novo.
        </Alert>
      ) : null}

      {devolucao.status === "RECUSADA" ? (
        <Alert tone="error">
          Recusada: {devolucao.recusaMotivo ?? "sem motivo registrado"}. O saldo voltou para a
          unidade.
        </Alert>
      ) : null}

      <Card title="A devolução">
        <SummaryGrid
          items={[
            { label: "Situação", value: <Badge tone={estado.tone}>{estado.label}</Badge> },
            {
              label: "Quantidade",
              value: `${formatar(devolucao.quantidade)} ${devolucao.unidadeMedida}`,
            },
            {
              label: "Validade do lote",
              value: devolucao.dataValidade ? toDate(devolucao.dataValidade) : "sem validade",
            },
            { label: "Motivo", value: devolucao.motivo ?? "—" },
            { label: "Solicitada em", value: toDate(devolucao.data) },
            { label: "Solicitada por", value: devolucao.solicitadaPor },
            {
              label: "Respondida em",
              value: devolucao.respondidaEm ? toDateTime(devolucao.respondidaEm) : "—",
            },
            { label: "Respondida por", value: devolucao.aceitaPor ?? "—" },
          ]}
        />
      </Card>

      <Card title="Documentos" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <IssueDocumentPanel
            referenciaId={devolucao.id}
            voltarPara={`/almoxarifado/devolucoes/${devolucao.id}`}
            modelos={modelos.filter((modelo) => modelo.escopo === "DEVOLUCAO_ESTOQUE")}
            emitidos={emitidos}
            podeEmitir={viewer.can("documents:issue")}
          />
        </div>
      </Card>
    </>
  );
}
