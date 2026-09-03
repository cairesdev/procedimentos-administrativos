import Link from "next/link";
import { notFound } from "next/navigation";
import { alvoNaTela } from "@/features/checklists/alvo";
import { findChecklist, findChecklistInvite } from "@/features/checklists/queries";
import { InviteButton } from "@/features/checklists/components/InviteButton";
import styles from "@/features/checklists/components/Checklist.module.css";
import { ItemActions } from "@/features/checklists/components/ItemActions";
import {
  atrasado, completoHoje, pendenciasPorPeso, porSecao, resumoDePendencias, situacaoDoItem,
} from "@/features/checklists/situacao";
import { CLASSIFICACOES, SITUACOES } from "@/features/checklists/types";
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

  const [modelos, emitidos, convite] = await Promise.all([
    listTemplates("CHECKLIST").catch(() => []),
    listDocumentsFor(id).catch(() => []),
    findChecklistInvite(id).catch(() => null),
  ]);

  // O link só faz sentido com item do fornecedor: sem nenhum, ele abriria uma
  // página vazia — e a API recusa por isso mesmo.
  const temItemDeFornecedor = checklist.itens.some((item) => item.paraFornecedor);

  const completo = completoHoje(checklist.itens);
  const vencidos = checklist.itens.filter((item) => situacaoDoItem(item) === "VENCIDO");

  /**
   * O que falta, por peso.
   *
   * "Faltam 3 obrigatórias e 1 essencial" diz onde correr; "faltam 4" só diz
   * que há trabalho — e é a obrigatória que o TCE cobra.
   */
  const pendencias = pendenciasPorPeso(checklist.itens);
  const grupos = porSecao(checklist.itens);

  return (
    <>
      <PageHeader
        title={checklist.titulo}
        subtitle={checklist.descricao ?? undefined}
        action={
          <span className={styles.cabecalho_acoes}>
            {completo ? <Badge tone="success">completo hoje</Badge> : null}
            {temItemDeFornecedor && viewer.can("checklists:manage") ? (
              <InviteButton checklistId={checklist.id} conviteAberto={convite} />
            ) : null}
          </span>
        }
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
                value: (() => {
                  const alvo = alvoNaTela(checklist);
                  const texto = alvo.detalhe ? `${alvo.texto} · ${alvo.detalhe}` : alvo.texto;
                  return alvo.href
                    ? <Link href={alvo.href} style={{ color: "var(--acao)" }}>{texto}</Link>
                    : texto;
                })(),
              },
              { label: "Modelo", value: checklist.modeloNome ?? "escrito na hora" },
              {
                label: "Responsável",
                value: checklist.setorNome ?? checklist.departamentoNome ?? "—",
              },
              { label: "Criado por", value: checklist.criadoPorNome ?? "—" },
              { label: "Criado em", value: toDate(checklist.criadoEm) },
              {
                label: "Em aberto",
                value: pendencias.total === 0
                  ? "nada pendente"
                  : `${resumoDePendencias(pendencias)} · ${checklist.itens.length} itens`,
                wide: true,
              },
            ]}
          />
        </Card>

        {grupos.map(([secao, itens]) => (
          <Card
            key={secao || "sem-secao"}
            title={secao || `Itens (${itens.length})`}
            padded={false}
          >
            <Table
              columns={["Exigência", "Quem cumpre", "Prazo", "Situação", "Última entrega", ""]}
              isEmpty={itens.length === 0}
              emptyMessage="Nenhum item nesta seção."
            >
            {itens.map((item) => {
              const situacao = situacaoDoItem(item);
              const estado = rotulo(situacao);
              const ciclo = item.ultimoCiclo;

              return (
                <tr key={item.id}>
                  <td>
                    {item.codigo ? (
                      <>
                        <code className={styles.codigo}>{item.codigo}</code>{" "}
                      </>
                    ) : null}
                    <strong>{item.titulo}</strong>
                    {item.classificacao ? (
                      <>
                        {" "}
                        <Badge
                          tone={CLASSIFICACOES.find(
                            (c) => c.value === item.classificacao,
                          )?.tone ?? "neutral"}
                        >
                          {CLASSIFICACOES.find(
                            (c) => c.value === item.classificacao,
                          )?.label ?? item.classificacao}
                        </Badge>
                      </>
                    ) : null}
                    {item.descricao ? (
                      <>
                        <br />
                        <small>{item.descricao}</small>
                      </>
                    ) : null}
                    {item.recorrente ? (
                      <>
                        <br />
                        <small className={styles.suave}>
                          vence a cada {item.periodicidadeDias} dias
                        </small>
                      </>
                    ) : null}
                    {item.exigeAnexo ? (
                      <>
                        <br />
                        <small className={styles.suave}>exige documento</small>
                      </>
                    ) : null}
                  </td>

                  <td>
                    {item.paraFornecedor
                      ? "fornecedor"
                      : item.setorNome ?? item.departamentoNome ?? "—"}
                    {item.apoios.length > 0 ? (
                      <>
                        <br />
                        {/* Os apoios veem o item na fila deles sem responder
                            por ele — o "COM JURÍDICO" da planilha. */}
                        <small className={styles.suave}>
                          com {item.apoios.map((apoio) => apoio.nome).join(", ")}
                        </small>
                      </>
                    ) : null}
                    {item.modeloNomeOriginal ? (
                      <>
                        <br />
                        <a
                          href={`/api/proxy/checklists/${checklist.id}/itens/${item.id}/modelo`}
                          className={styles.anexo}
                        >
                          baixar modelo
                        </a>
                      </>
                    ) : null}
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
                        <small className={styles.recusa}>
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
                              className={styles.anexo}
                            >
                              {anexo.nomeOriginal}
                            </a>
                          </div>
                        ))}
                        {item.historico.length > 0 ? (
                          <small className={styles.discreto}>
                            {item.historico.length}{" "}
                            {item.historico.length === 1 ? "entrega anterior" : "entregas anteriores"}
                          </small>
                        ) : null}
                      </>
                    ) : (
                      <span className={styles.vazio}>—</span>
                    )}
                  </td>

                  <td className={styles.celula_acoes}>
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
        ))}

        <Card title="Documentos" padded={false}>
          <div className={styles.painel}>
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
