import { notFound } from "next/navigation";
import {
  getReceiptPlan, getReleasePlan, getStockRequest,
} from "@/features/stock/queries";
import { ReceiptPanel } from "@/features/stock/components/ReceiptPanel";
import { ReleasePanel } from "@/features/stock/components/ReleasePanel";
import { RequestActions } from "@/features/stock/components/RequestActions";
import { RequestItems } from "@/features/stock/components/RequestItems";
import { statusOf } from "@/features/stock/types";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Badge, Card, PageHeader, SummaryGrid } from "@/shared/ui/layout";
import { toDate, toDateTime } from "@/shared/ui/labels";

type RequestPageProps = { params: Promise<{ id: string }> };

export default async function StockRequestPage({ params }: RequestPageProps) {
  const viewer = await requirePermission("stock:read", "ALMOXARIFADO");
  const { id } = await params;

  const pedido = await getStockRequest(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const situacao = statusOf(pedido.status);
  const podeLiberar = pedido.status === "SOLICITADA" && viewer.can("stock:manage");
  const podeReceber =
    (pedido.status === "LIBERADA" || pedido.status === "EM_TRANSITO")
    && viewer.can("stock:receive");

  // Cada plano só é buscado quando a etapa é a da vez: pedir os dois sempre
  // faria uma chamada que a API recusa pelo estado.
  const [planoLiberacao, planoRecebimento, modelos, emitidos] = await Promise.all([
    podeLiberar ? getReleasePlan(id).catch(() => null) : Promise.resolve(null),
    podeReceber ? getReceiptPlan(id).catch(() => null) : Promise.resolve(null),
    // A prefeitura pode ter desativado os modelos, ou nada ter sido emitido
    // ainda: nenhum dos dois é motivo para derrubar a tela do pedido.
    listTemplates("ALMOXARIFADO").catch(() => []),
    listDocumentsFor(id).catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title={`Pedido · ${pedido.localSolicitanteNome}`}
        subtitle={`Aberto em ${toDate(pedido.data)} por ${pedido.autorNome}`}
        action={<Badge tone={situacao.tone}>{situacao.label}</Badge>}
      />

      <Card>
        <SummaryGrid
          items={[
            { label: "Local solicitante", value: pedido.localSolicitanteNome },
            { label: "Tipo de estoque", value: pedido.tipoEstoqueNome ?? "—" },
            { label: "Itens", value: pedido.itens.length },
            {
              label: "Enviado em",
              value: pedido.enviadaEm ? toDateTime(pedido.enviadaEm) : "—",
            },
            {
              label: "Reserva expira",
              value: pedido.reservaExpiraEm ? toDateTime(pedido.reservaExpiraEm) : "sem prazo",
            },
            {
              label: "Liberado em",
              value: pedido.liberadaEm ? toDateTime(pedido.liberadaEm) : "—",
            },
            {
              label: "Recebido em",
              value: pedido.recebidaEm ? toDateTime(pedido.recebidaEm) : "—",
            },
          ]}
        />
      </Card>

      {pedido.motivoRecusa ? (
        <Alert tone="error">Recusado: {pedido.motivoRecusa}</Alert>
      ) : null}

      {pedido.status === "EXPIRADA" ? (
        <Alert tone="info">
          A reserva venceu antes da liberação e o saldo voltou ao almoxarifado. Para retomar, abra
          um pedido novo.
        </Alert>
      ) : null}

      <Card title="Itens pedidos" padded={false}>
        <RequestItems itens={pedido.itens} />
      </Card>

      {/*
        O card aparece sempre que a etapa é a da vez, mesmo se o plano falhar.
        Antes, o erro virava ausência silenciosa do botão: o almoxarife via a
        tela sem "Liberar" e concluía que não tinha permissão, enquanto o erro
        real ficava só no log do servidor.
      */}
      {podeLiberar ? (
        <Card title="Liberar" padded={false}>
          <div style={{ padding: "14px 16px" }}>
            {planoLiberacao ? (
              <ReleasePanel plano={planoLiberacao} />
            ) : (
              <Alert tone="error">
                Não foi possível montar a liberação deste pedido. Recarregue a página; se
                continuar, avise o suporte com o número do pedido.
              </Alert>
            )}
          </div>
        </Card>
      ) : null}

      {podeReceber ? (
        <Card title="Conferir o que chegou" padded={false}>
          <div style={{ padding: "14px 16px" }}>
            {planoRecebimento ? (
              <ReceiptPanel plano={planoRecebimento} />
            ) : (
              <Alert tone="error">
                Não foi possível montar a conferência deste pedido. Recarregue a página; se
                continuar, avise o suporte com o número do pedido.
              </Alert>
            )}
          </div>
        </Card>
      ) : null}

      <Card title="Documentos" padded={false}>
        <div style={{ padding: "14px 16px 0" }}>
          <IssueDocumentPanel
            referenciaId={pedido.id}
            voltarPara={`/almoxarifado/solicitacoes/${pedido.id}`}
            // Só as peças que falam do pedido: o comprovante de entrada é da
            // remessa e sai na tela dela, com outra referência.
            modelos={modelos.filter((modelo) => modelo.escopo === "SOLICITACAO_ESTOQUE")}
            emitidos={emitidos}
            // Rascunho não rende comprovante: nada foi pedido ainda.
            podeEmitir={pedido.status !== "RASCUNHO" && viewer.can("documents:issue")}
          />
        </div>
      </Card>

      {!podeLiberar && !podeReceber ? (
        <Card title="Ações">
          <RequestActions pedido={pedido} podePedir={viewer.can("stock:request")} />
        </Card>
      ) : null}
    </>
  );
}
