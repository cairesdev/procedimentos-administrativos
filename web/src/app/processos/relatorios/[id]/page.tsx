import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getBySector, getPanorama, getReportCut } from "@/features/reports/queries";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import type { DocumentTemplate, IssuedDocument } from "@/features/documents/types";
import { ApiError } from "@/shared/api/http-client";
import { lista } from "@/shared/api/colecao";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader, Stack, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";

type Props = { params: Promise<{ id: string }> };

/**
 * O recorte salvo, e o caminho até a peça assinada.
 *
 * A tela de filtros não grava nada — é consulta, e consulta boa se refaz. Este
 * endereço existe para o outro caso: quando o relatório vai virar papel, e
 * papel precisa de um registro para o documento apontar.
 *
 * Os números são reapurados aqui também. O que ficou gravado foi a pergunta;
 * a resposta se congela só na emissão, dentro do corpo da peça.
 */
export default async function RecorteSalvoPage({ params }: Props) {
  const viewer = await requirePermission("reports:read", "PROCESSOS");
  const { id } = await params;

  const recorte = await getReportCut(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });
  if (!recorte?.id) notFound();

  const filtros = {
    inicio: recorte.periodoInicio,
    fim: recorte.periodoFim,
    unidade: recorte.filtros.unidadeId ?? undefined,
    fornecedor: recorte.filtros.fornecedorId ?? undefined,
    modalidade: recorte.filtros.modalidade ?? undefined,
    setor: recorte.filtros.setorId ?? undefined,
  };

  const escopo = recorte.tipo === "SETOR" ? "RELATORIO_SETOR" : "RELATORIO_PANORAMA";

  const [panorama, porSetor, modelos, emitidos] = await Promise.all([
    recorte.tipo === "SETOR" ? Promise.resolve(null) : getPanorama(filtros).catch(() => null),
    recorte.tipo === "SETOR" ? getBySector(filtros).catch(() => null) : Promise.resolve(null),
    listTemplates("PROCESSOS").then(lista<DocumentTemplate>).catch(() => []),
    listDocumentsFor(id).then(lista<IssuedDocument>).catch(() => []),
  ]);

  const periodo = `${toDate(recorte.periodoInicio)} a ${toDate(recorte.periodoFim)}`;

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/processos/relatorios"
          style={{ color: "var(--texto_suave)", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Relatórios
        </Link>
      </p>

      <PageHeader
        title={recorte.tipo === "SETOR" ? "Tramitação por setor" : "Panorama de contratações"}
        subtitle={periodo}
      />

      <Stack>
        <Alert tone="info">
          Os números abaixo são apurados agora. Ao emitir, eles ficam presos ao corpo do documento
          — que é o que a prestação de contas precisa: um papel que continue dizendo daqui a um ano
          o que se via hoje.
        </Alert>

        {panorama ? (
          <Card title="No período">
            <SummaryGrid
              items={[
                { label: "Licitações", value: `${panorama.totais.licitacoes}` },
                { label: "Contratos", value: `${panorama.totais.contratos}` },
                { label: "Fornecedores", value: `${panorama.totais.fornecedores}` },
                { label: "Contratado", value: toCurrency(panorama.totais.valorContratado) },
                { label: "Pedido", value: toCurrency(panorama.totais.valorPedido) },
                { label: "Saldo", value: toCurrency(panorama.totais.saldo) },
              ]}
            />
          </Card>
        ) : null}

        {porSetor ? (
          <>
            <Card title="No período">
              <SummaryGrid
                items={[
                  { label: "Entraram", value: `${porSetor.totais.entraram}` },
                  { label: "Saíram", value: `${porSetor.totais.sairam}` },
                  { label: "Ainda no setor", value: `${porSetor.totais.parados}` },
                ]}
              />
            </Card>

            <Card title={`${porSetor.setores.length} setores`} padded={false}>
              <Table
                columns={["Setor", "Entraram", "Saíram", "Ainda no setor", "Dias em média"]}
                isEmpty={porSetor.setores.length === 0}
                emptyMessage="Nenhum processo passou por setor nenhum neste período."
              >
                {porSetor.setores.map((setor) => (
                  <tr key={setor.id}>
                    <td>{setor.nome}</td>
                    <td className={numericCell}>{setor.entraram}</td>
                    <td className={numericCell}>{setor.sairam}</td>
                    <td className={numericCell}>{setor.parados}</td>
                    <td className={numericCell}>{setor.sairam > 0 ? setor.diasMedia : "—"}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          </>
        ) : null}

        <Card title="Documentos" padded={false}>
          <div style={{ padding: "14px 16px 0" }}>
            <IssueDocumentPanel
              referenciaId={id}
              voltarPara={`/processos/relatorios/${id}`}
              modelos={modelos.filter((modelo) => modelo.escopo === escopo)}
              emitidos={emitidos}
              podeEmitir={viewer.can("documents:issue")}
            />
          </div>
        </Card>
      </Stack>
    </>
  );
}
