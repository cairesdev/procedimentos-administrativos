import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { findServiceRecord, listRequirements } from "@/features/protocol/queries";
import { RequirementPanel } from "@/features/protocol/components/RequirementPanel";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { PROCESS_SCOPES } from "@/features/documents/types";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { toDateTime, humanize } from "@/shared/ui/labels";
import { Badge, Card, PageHeader, Stack, SummaryGrid } from "@/shared/ui/layout";

type ServicePageProps = { params: Promise<{ id: string }> };

const documento = (bruto: string) => {
  if (bruto.length === 11) return bruto.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (bruto.length === 14) {
    return bruto.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return bruto;
};

/**
 * Detalhe do atendimento dentro do próprio protocolo.
 *
 * Existe porque quem atende no balcão não tem o módulo de processos: sem esta
 * tela, o atendente abriria o pedido e nunca mais o veria. Mostra o pedido e o
 * andamento com o requerente — a tramitação interna continua sendo do setor.
 */
export default async function ServiceDetailPage({ params }: ServicePageProps) {
  const viewer = await requirePermission("protocol:read", "PROTOCOLO");
  const { id } = await params;

  const atendimento = await findServiceRecord(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const [exigencias, modelos, emitidos] = await Promise.all([
    listRequirements(id).catch(() => []),
    listTemplates().catch(() => []),
    listDocumentsFor(id).catch(() => []),
  ]);

  const aberto = atendimento.status === "ABERTO" || atendimento.status === "TRAMITANDO";

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/protocolo/atendimentos"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Atendimentos
        </Link>
      </p>

      <PageHeader
        title={`Protocolo ${atendimento.numeroProtocolo}`}
        subtitle={atendimento.assuntoNome ?? "Sem assunto classificado"}
        action={
          <Badge tone={aberto ? "accent" : "success"}>{atendimento.status.toLowerCase()}</Badge>
        }
      />

      <Stack>
        <Card title="Pedido">
          <SummaryGrid
            items={[
              { label: "Requerente", value: atendimento.requerenteNome },
              { label: "CPF/CNPJ", value: documento(atendimento.requerenteDocumento) },
              { label: "Tipo", value: humanize(atendimento.requerenteTipo) },
              { label: "Contato", value: atendimento.requerenteEmail ?? atendimento.requerenteTelefone ?? "—" },
              { label: "Aberto em", value: toDateTime(atendimento.dataAbertura) },
              {
                label: "Origem",
                value: atendimento.origemAtendimento === "PORTAL" ? "Portal do cidadão" : "Balcão",
              },
              { label: "Setor responsável", value: atendimento.setorAtualNome ?? "—" },
              {
                label: "Prazo do assunto",
                value: atendimento.prazoDias ? `${atendimento.prazoDias} dias` : "—",
              },
              { label: "Processo administrativo", value: atendimento.numeroProcessoAdm },
              {
                label: "Concluído em",
                value: atendimento.dataEncerramento
                  ? toDateTime(atendimento.dataEncerramento)
                  : "—",
              },
              { label: "O que foi pedido", value: atendimento.descricaoPedido ?? "—", wide: true },
            ]}
          />
        </Card>

        <Card title="Exigências">
          {/* O balcão vê o que foi exigido, mas quem exige é o setor que analisa. */}
          <RequirementPanel
            processoId={atendimento.id}
            exigencias={exigencias}
            podeExigir={aberto && viewer.can("processes:dispatch")}
          />
        </Card>

        <Card title="Documentos" padded={false}>
          <div style={{ padding: "14px 16px 0" }}>
            <IssueDocumentPanel
              referenciaId={atendimento.id}
              voltarPara={`/protocolo/atendimentos/${atendimento.id}`}
              modelos={modelos.filter((modelo) => PROCESS_SCOPES.includes(modelo.escopo))}
              emitidos={emitidos}
              podeEmitir={aberto && viewer.can("documents:issue")}
            />
          </div>
        </Card>
      </Stack>
    </>
  );
}
