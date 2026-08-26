import { apiRequest, ApiError } from "@/shared/api/http-client";
import { RequirementReply } from "@/features/protocol/components/RequirementReply";
import type { PublicTracking, Requirement } from "@/features/protocol/types";
import { app } from "@/shared/config/app";
import { Button } from "@/shared/ui/button";
import { Alert, Badge, Card, PageHeader, Stack, SummaryGrid } from "@/shared/ui/layout";
import { toDate, toDateTime } from "@/shared/ui/labels";

type ProtocoloPageProps = {
  searchParams: Promise<{ protocolo?: string; documento?: string }>;
};

const situacao = {
  ABERTO: { rotulo: "recebido", tone: "accent" },
  TRAMITANDO: { rotulo: "em análise", tone: "accent" },
  ENCERRADO: { rotulo: "concluído", tone: "success" },
  CANCELADO: { rotulo: "cancelado", tone: "neutral" },
} as const;

/**
 * Consulta pública do protocolo. Exige número **e** documento: o número é
 * sequencial, e sozinho deixaria qualquer um ler o pedido do vizinho.
 */
export default async function ProtocoloPublicoPage({ searchParams }: ProtocoloPageProps) {
  const { protocolo, documento } = await searchParams;
  const consultou = Boolean(protocolo?.trim() && documento?.trim());

  const acompanhamento = consultou
    ? await apiRequest<PublicTracking>("/conferencia/protocolo", {
        method: "POST",
        body: { protocolo: protocolo!.trim(), documento: documento!.trim() },
      }).catch((erro) => {
        if (erro instanceof ApiError && (erro.status === 404 || erro.status === 429)) return null;
        throw erro;
      })
    : null;

  // Mesma credencial da consulta: quem já provou o par vê as pendências dele.
  const exigencias = acompanhamento
    ? await apiRequest<Requirement[]>("/publico/pedidos/exigencias", {
        method: "POST",
        body: { protocolo: protocolo!.trim(), documento: documento!.trim() },
      }).catch(() => [])
    : [];

  const estado = acompanhamento
    ? situacao[acompanhamento.status as keyof typeof situacao] ?? { rotulo: "—", tone: "neutral" as const }
    : null;

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 20px", display: "grid", gap: "18px", alignContent: "start" }}>
      <PageHeader
        title="Acompanhe seu protocolo"
        subtitle={`Consulte a situação do pedido que você abriu — ${app.shortName}`}
      />

      <Stack>
        <Card>
          <form method="get" style={{ display: "grid", gap: "12px" }}>
            <label htmlFor="protocolo" style={{ fontSize: "13px", fontWeight: 500 }}>
              Número do protocolo
            </label>
            <input
              id="protocolo"
              name="protocolo"
              required
              defaultValue={protocolo ?? ""}
              placeholder="000123/2026"
              autoComplete="off"
            />

            <label htmlFor="documento" style={{ fontSize: "13px", fontWeight: 500 }}>
              CPF ou CNPJ de quem abriu
            </label>
            <input
              id="documento"
              name="documento"
              required
              defaultValue={documento ?? ""}
              placeholder="Só números"
              autoComplete="off"
            />

            <div>
              <Button type="submit">Consultar</Button>
            </div>
          </form>
        </Card>

        {consultou && !acompanhamento ? (
          <Alert tone="error">
            Não encontramos protocolo com esse número para o documento informado. Confira os dois —
            o documento precisa ser o de quem abriu o pedido.
          </Alert>
        ) : null}

        {acompanhamento ? (
          <>
            <Card title={`Protocolo ${acompanhamento.numeroProtocolo}`}>
              <SummaryGrid
                items={[
                  {
                    label: "Situação",
                    value: <Badge tone={estado!.tone}>{estado!.rotulo}</Badge>,
                  },
                  { label: "Aberto em", value: toDateTime(acompanhamento.dataAbertura) },
                  { label: "Assunto", value: acompanhamento.assuntoNome ?? "—" },
                  { label: "Setor responsável", value: acompanhamento.setorAtualNome ?? "—" },
                  {
                    label: "Prazo de resposta",
                    value: acompanhamento.prazoDias ? `${acompanhamento.prazoDias} dias` : "—",
                  },
                  {
                    label: "Concluído em",
                    value: acompanhamento.dataEncerramento
                      ? toDateTime(acompanhamento.dataEncerramento)
                      : "—",
                  },
                  { label: "Requerente", value: acompanhamento.requerenteNome },
                  { label: "Órgão", value: acompanhamento.orgaoNome },
                  {
                    label: "Seu pedido",
                    value: acompanhamento.descricaoPedido ?? "—",
                    wide: true,
                  },
                ]}
              />
            </Card>

            <RequirementReply
              protocolo={acompanhamento.numeroProtocolo}
              documento={documento!.trim()}
              exigencias={exigencias}
            />

            <Card title="Andamento">
              {acompanhamento.andamento.length === 0 ? (
                <p style={{ fontSize: "13px", color: "var(--texto_suave)" }}>
                  O pedido foi recebido e ainda não mudou de setor.
                </p>
              ) : (
                <ol style={{ display: "grid", gap: "8px", paddingLeft: "18px", fontSize: "13px" }}>
                  {acompanhamento.andamento.map((passo, indice) => (
                    <li key={`${passo.data}-${indice}`}>
                      {toDate(passo.data)} — encaminhado para {passo.setorNome ?? "outro setor"}
                    </li>
                  ))}
                </ol>
              )}

              <p style={{ fontSize: "11.5px", color: "var(--texto_suave)", marginTop: "12px" }}>
                Esta página mostra a movimentação do seu pedido. Pareceres e despachos internos são
                documentos de trabalho da administração e não aparecem aqui.
              </p>
            </Card>
          </>
        ) : null}
      </Stack>
    </div>
  );
}
