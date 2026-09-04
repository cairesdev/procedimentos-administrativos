import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActiveAssignmentId, getProfile } from "@/features/auth/queries";
import { listAllContracts } from "@/features/contracts/queries";
import { ChecklistCard } from "@/features/checklists/components/ChecklistCard";
import { findProcess, listAttachments, listSupplyOrders } from "@/features/processes/queries";
import { AttachmentPanel } from "@/features/processes/components/AttachmentPanel";
import { ProcessActions } from "@/features/processes/components/ProcessActions";
import { ProcessTimeline } from "@/features/processes/components/ProcessTimeline";
import { SupplyOrderPanel } from "@/features/processes/components/SupplyOrderPanel";
import { listSectors } from "@/features/sectors/queries";
import { getWorkflow } from "@/features/workflows/queries";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { PROCESS_SCOPES } from "@/features/documents/types";
import { findRequest } from "@/features/requests/queries";
import { RequestDetailView } from "@/features/requests/components/RequestDetailView";
import { listRequirements } from "@/features/protocol/queries";
import { RequirementPanel } from "@/features/protocol/components/RequirementPanel";
import { requirePermission } from "@/shared/auth/guards";
import { deadlineOf } from "@/features/processes/deadline";
import { humanize, toDate } from "@/shared/ui/labels";
import { Alert, Badge, Card, Columns, PageHeader, Stack, SummaryGrid } from "@/shared/ui/layout";

type ProcessPageProps = { params: Promise<{ id: string }> };

export default async function ProcessDetailPage({ params }: ProcessPageProps) {
  const viewer = await requirePermission("processes:read", "PROCESSOS");
  const { id } = await params;

  const [process, profile, activeAssignmentId, sectors, contracts, modelos, emitidos, anexos] =
    await Promise.all([
      findProcess(id),
      getProfile(),
      getActiveAssignmentId(),
      listSectors(),
      listAllContracts(),
      listTemplates("PROCESSOS"),
      listDocumentsFor(id),
      // Anexo não derruba a tela do processo: se o armazenamento estiver fora,
      // o que interessa — tramitação, prazo, despacho — continua aparecendo.
      listAttachments(id).catch(() => []),
    ]);

  // O override de destino é configurado por tipo de processo. Serve só para
  // liberar a escolha manual do setor: quem não lê fluxos vê a tela sem essa
  // opção, em vez de não ver a tela.
  const workflow = await getWorkflow(process.tipoProcesso).catch(() => null);

  // O processo nasce de uma solicitação: quem despacha precisa ver o que foi
  // pedido, de qual contrato e por qual valor — sem sair da tela.
  const solicitacao = process.solicitacaoId
    ? await findRequest(process.solicitacaoId).catch(() => null)
    : null;

  // Exigências só existem em atendimento externo: é o requerente quem responde.
  const exigencias = process.tipoProcesso === "ATENDIMENTO_EXTERNO"
    ? await listRequirements(process.id).catch(() => [])
    : [];

  /**
   * A ordem sai do contrato que a solicitação usou — e do valor que ela
   * empenhou nele. Oferecer a lista inteira de contratos da prefeitura fazia
   * o formulário aceitar o que a API recusa em seguida, por não participarem
   * do processo. Sem solicitação (atendimento externo), cai na lista geral.
   */
  const contratosDaSolicitacao = solicitacao?.contratos ?? [];
  const valorPorContrato = Object.fromEntries(
    contratosDaSolicitacao.map((contrato) => [
      contrato.id,
      (solicitacao?.itens ?? [])
        .filter((item) => item.contratoId === contrato.id)
        .reduce((soma, item) => soma + item.valorCalculado, 0),
    ]),
  );

  const opcoesDeContrato = contratosDaSolicitacao.length > 0
    ? contratosDaSolicitacao.map((contrato) => ({
      value: contrato.id,
      label: `Contrato ${contrato.numero} · ${contrato.fornecedorRazaoSocial}`,
    }))
    : contracts.map((contrato) => ({
      value: contrato.id,
      label: `Contrato ${contrato.numero}`,
    }));

  /**
   * Ler a ordem não é emitir a ordem.
   *
   * Pedia `processes:order` — a mesma permissão de emitir —, e a controladoria,
   * que precisa conferir a ordem para dar parecer, não via o card.
   */
  const podeVerOrdens = viewer.can("processes:read");
  const ordens = podeVerOrdens ? await listSupplyOrders(process.id).catch(() => []) : [];

  // Os documentos de cada ordem são buscados pela referência dela, não do
  // processo: a peça fala da ordem, e é lá que ela precisa aparecer.
  const documentosPorOrdem = Object.fromEntries(
    await Promise.all(
      ordens.map(async (ordem) => [ordem.id, await listDocumentsFor(ordem.id).catch(() => [])] as const),
    ),
  );

  const currentSector = sectors.find((sector) => sector.id === process.setorAtualId);
  const isOpen = process.status === "ABERTO" || process.status === "TRAMITANDO";
  const prazo = deadlineOf(process, process.limiarAlertaDias);

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/processos/fila"
          style={{
            color: "var(--texto_suave)",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Fila do setor
        </Link>
      </p>

      <PageHeader
        title={`Protocolo ${process.numeroProtocolo}`}
        subtitle={`Processo administrativo ${process.numeroProcessoAdm}`}
        action={<Badge tone={isOpen ? "accent" : "success"}>{process.status.toLowerCase()}</Badge>}
      />

      <Columns>
        <Stack>
          <Card title="Tramitação">
            <ProcessTimeline dispatches={process.despachos} />
          </Card>

          {solicitacao ? (
            <RequestDetailView request={solicitacao} />
          ) : (
            <Card title="Solicitação">
              <Alert tone="info">
                Este processo não veio de uma solicitação de itens — foi aberto direto no
                protocolo.
              </Alert>
            </Card>
          )}

          {/*
            Os arquivos ficam na coluna larga, com a tramitação: são o que
            sustenta cada ato dela, e a tabela de nomes de arquivo não cabe na
            coluna estreita sem virar uma pilha de reticências.
          */}
          <AttachmentPanel
            processoId={process.id}
            anexos={anexos}
            podeAnexar={isOpen && viewer.can("processes:dispatch")}
          />
        </Stack>

        <Stack>
          <Card title="Situação">
            <SummaryGrid
              items={[
                { label: "Tipo", value: humanize(process.tipoProcesso) },
                { label: "Setor atual", value: currentSector?.nome ?? "—" },
                { label: "Despachos", value: `${process.despachos.length}` },
                { label: "No setor desde", value: toDate(process.entrouNoSetorEm) },
                {
                  label: "Prazo da etapa",
                  value:
                    prazo.state === "sem-prazo" ? (
                      "sem prazo"
                    ) : (
                      <Badge tone={prazo.tone}>{prazo.label}</Badge>
                    ),
                },
              ]}
            />
          </Card>

          {isOpen ? (
            <Card title="Ações">
              <ProcessActions
                processId={process.id}
                assignments={profile.lotacoes}
                activeAssignmentId={activeAssignmentId}
                sectors={sectors.map((sector) => ({ value: sector.id, label: sector.nome }))}
                contracts={opcoesDeContrato}
                contractValues={valorPorContrato}
                canDispatch={viewer.can("processes:dispatch")}
                canGiveOpinion={viewer.can("processes:opinion")}
                canEmitOrder={viewer.can("processes:order")}
                allowManualDestination={workflow?.permiteOverrideUsuario ?? false}
              />
            </Card>
          ) : null}

          {process.tipoProcesso === "ATENDIMENTO_EXTERNO" ? (
            <Card title="Exigências">
              <RequirementPanel
                processoId={process.id}
                exigencias={exigencias}
                podeExigir={isOpen && viewer.can("processes:dispatch")}
              />
            </Card>
          ) : null}

          <ChecklistCard alvoTipo="PROCESSO" alvoId={process.id}
          podeCriar={viewer.can("checklists:manage")}
        />

          {podeVerOrdens ? (
            <Card title="Ordens de fornecimento">
              <SupplyOrderPanel
                ordens={ordens}
                documentosPorOrdem={documentosPorOrdem}
                modelos={modelos.filter((modelo) => modelo.escopo === "ORDEM_FORNECIMENTO")}
                voltarPara={`/processos/fila/${process.id}`}
                podeEmitir={viewer.can("documents:issue")}
                processId={process.id}
                podeInformarNota={viewer.can("orders:invoice")}
              />
            </Card>
          ) : null}

          {/* Peças do processo: emitir é ato explícito de quem conduz. */}
          <Card title="Documentos" padded={false}>
            <div style={{ padding: "14px 16px 0" }}>
              <IssueDocumentPanel
                referenciaId={process.id}
                voltarPara={`/processos/fila/${process.id}`}
                // Só peças cujo escopo fala do processo: ordem e comprovante
                // são emitidos nas telas deles, com outra referência.
                modelos={modelos.filter((modelo) => PROCESS_SCOPES.includes(modelo.escopo))}
                emitidos={emitidos}
                podeEmitir={isOpen && viewer.can("documents:issue")}
              />
            </div>
          </Card>
        </Stack>
      </Columns>
    </>
  );
}
