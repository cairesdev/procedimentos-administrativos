import { notFound } from "next/navigation";
import { findChecklist } from "@/features/checklists/queries";
import { ItemActions } from "@/features/checklists/components/ItemActions";
import { completoHoje, situacaoDoItem, atrasado } from "@/features/checklists/situacao";
import { SITUACOES } from "@/features/checklists/types";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { toDate, toDateTime } from "@/shared/ui/labels";
import { Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table } from "@/shared/ui/layout";

type PageProps = { params: Promise<{ id: string }> };

const rotulo = (situacao: string) =>
  SITUACOES.find((item) => item.value === situacao)
  ?? { label: situacao.toLowerCase(), tone: "neutral" as const };

export default async function ChecklistPage({ params }: PageProps) {
  const viewer = await requirePermission("checklists:read", "CHECKLIST");
  const { id } = await params;

  const checklist = await findChecklist(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });

  const [modelos, emitidos] = await Promise.all([
    listTemplates("CHECKLIST").catch(() => []),
    listDocumentsFor(id).catch(() => []),
  ]);

  const completo = completoHoje(checklist.itens);
  const emAberto = checklist.itens.filter((item) => {
    const situacao = situacaoDoItem(item);
    return situacao === "PENDENTE" || situacao === "VENCIDO";
  });
  const vencidos = checklist.itens.filter((item) => situacaoDoItem(item) === "VENCIDO");

  return (
    <>
      <PageHeader
        title={checklist.titulo}
        subtitle={checklist.descricao ?? undefined}
        action={completo ? <Badge tone="success">completo hoje</Badge> : null}
      />

      <Stack>
        {vencidos.length > 0 ? (
          <Alert tone="error">
            {vencidos.length === 1
              ? "Um item venceu e voltou a ser exigível."
              : `${vencidos.length} itens venceram e voltaram a ser exigíveis.`}{" "}
            O cumprimento anterior continua no histórico.
          </Alert>
        ) : null}

        {completo ? (
          <Alert tone="info">
            Todos os itens estão cumpridos <strong>hoje</strong>. Itens com prazo de validade
            voltam a ser exigíveis quando vencerem — e a declaração emitida vale como registro do
            dia em que sair.
          </Alert>
        ) : null}

        <Card title="O checklist">
          <SummaryGrid
            items={[
              {
                label: "Referente a",
                value: checklist.alvoTipo
                  ? `${checklist.alvoTipo.toLowerCase()} · ${checklist.alvoId?.slice(0, 8)}`
                  : "lista avulsa",
              },
              { label: "Modelo", value: checklist.modeloNome ?? "escrito na hora" },
              {
                label: "Responsável",
                value: checklist.setorNome ?? checklist.departamentoNome ?? "—",
              },
              { label: "Criado por", value: checklist.criadoPorNome ?? "—" },
              { label: "Criado em", value: toDate(checklist.criadoEm) },
              { label: "Em aberto", value: `${emAberto.length} de ${checklist.itens.length}` },
            ]}
          />
        </Card>

        <Card title={`Itens (${checklist.itens.length})`} padded={false}>
          <Table
            columns={["Exigência", "Quem cumpre", "Prazo", "Situação", "Última entrega", ""]}
            isEmpty={checklist.itens.length === 0}
            emptyMessage="Este checklist não tem item nenhum."
          >
            {checklist.itens.map((item) => {
              const situacao = situacaoDoItem(item);
              const estado = rotulo(situacao);
              const ciclo = item.ultimoCiclo;

              return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.titulo}</strong>
                    {item.descricao ? (
                      <>
                        <br />
                        <small>{item.descricao}</small>
                      </>
                    ) : null}
                    {item.recorrente ? (
                      <>
                        <br />
                        <small style={{ color: "var(--texto_suave)" }}>
                          vence a cada {item.periodicidadeDias} dias
                        </small>
                      </>
                    ) : null}
                    {item.exigeAnexo ? (
                      <>
                        <br />
                        <small style={{ color: "var(--texto_suave)" }}>exige documento</small>
                      </>
                    ) : null}
                  </td>

                  <td>
                    {item.paraFornecedor
                      ? "fornecedor"
                      : item.setorNome ?? item.departamentoNome ?? "—"}
                  </td>

                  <td>
                    {item.prazoLimite ? toDate(item.prazoLimite) : "—"}
                    {atrasado(item, situacao) ? (
                      <>
                        <br />
                        <Badge tone="warning">atrasado</Badge>
                      </>
                    ) : null}
                  </td>

                  <td>
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                    {item.dispensadoEm ? (
                      <>
                        <br />
                        <small>{item.dispensaMotivo}</small>
                      </>
                    ) : null}
                    {ciclo?.situacao === "RECUSADO" ? (
                      <>
                        <br />
                        <small style={{ color: "var(--perigo)" }}>
                          Recusa: {ciclo.recusaMotivo}
                        </small>
                      </>
                    ) : null}
                  </td>

                  <td>
                    {ciclo ? (
                      <>
                        {toDateTime(ciclo.cumpridoEm)}
                        <br />
                        <small>
                          por {ciclo.cumpridoPorNome ?? "fornecedor"}
                          {ciclo.vigenciaAte ? ` · vale até ${toDate(ciclo.vigenciaAte)}` : ""}
                        </small>
                        {ciclo.anexos.map((anexo) => (
                          <div key={anexo.id}>
                            <a
                              href={`/api/proxy/checklists/${checklist.id}/anexos/${anexo.id}/download`}
                              style={{ fontSize: "12px", color: "var(--acao)" }}
                            >
                              {anexo.nomeOriginal}
                            </a>
                          </div>
                        ))}
                        {item.historico.length > 0 ? (
                          <small style={{ color: "var(--texto_apagado)" }}>
                            {item.historico.length}{" "}
                            {item.historico.length === 1 ? "entrega anterior" : "entregas anteriores"}
                          </small>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ color: "var(--texto_apagado)" }}>—</span>
                    )}
                  </td>

                  <td style={{ whiteSpace: "nowrap" }}>
                    <ItemActions
                      checklistId={checklist.id}
                      item={item}
                      podeCumprir={viewer.can("checklists:fulfill")}
                      podeConferir={viewer.can("checklists:verify")}
                      podeDispensar={viewer.can("checklists:manage")}
                    />
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <Card title="Documentos" padded={false}>
          <div style={{ padding: "14px 16px 0" }}>
            {completo ? null : (
              <Alert tone="info">
                A declaração de conclusão fala de uma lista completa. Com item em aberto, ela sairia
                dizendo o contrário do que mostra.
              </Alert>
            )}
            <IssueDocumentPanel
              referenciaId={checklist.id}
              voltarPara={`/checklists/${checklist.id}`}
              modelos={modelos.filter((modelo) => modelo.escopo === "CHECKLIST")}
              emitidos={emitidos}
              podeEmitir={completo && viewer.can("documents:issue")}
            />
          </div>
        </Card>
      </Stack>
    </>
  );
}
