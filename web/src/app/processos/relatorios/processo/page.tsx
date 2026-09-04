import Link from "next/link";
import { getProcessDossier, searchProcesses } from "@/features/reports/queries";
import { bidModalityLabel } from "@/features/bids/types";
import { requirePermission } from "@/shared/auth/guards";
import {
  Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table, celulaLonga, numericCell,
} from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { LinhasPorCategoria } from "@/shared/ui/LinhasPorCategoria";
import { humanize, toCurrency } from "@/shared/ui/labels";
import { TabNav } from "@/shared/ui/TabNav";

type Props = { searchParams: Promise<{ busca?: string; processo?: string }> };

const abas = (ativa: "panorama" | "setor" | "processo") => [
  { rotulo: "Panorama", href: "/processos/relatorios", ativa: ativa === "panorama" },
  { rotulo: "Por setor", href: "/processos/relatorios/setor", ativa: ativa === "setor" },
  { rotulo: "Processo", href: "/processos/relatorios/processo", ativa: ativa === "processo" },
];

/**
 * Tudo sobre um processo, numa folha só.
 *
 * Hoje isso exige abrir cinco telas — o processo, a licitação, o contrato, os
 * itens, a tramitação — e juntar de cabeça. É a consulta que o controle interno
 * faz antes de dar parecer, e a que o Tribunal pede quando questiona a despesa.
 *
 * Busca e resultado moram no mesmo endereço, ambos na URL: o dossiê aberto pode
 * ser mandado por mensagem, e quem recebe abre exatamente o que se estava
 * olhando.
 */
export default async function DossiePage({ searchParams }: Props) {
  await requirePermission("reports:read", "PROCESSOS");
  const { busca = "", processo: processoId } = await searchParams;

  const [encontrados, dossie] = await Promise.all([
    busca.trim().length >= 2 ? searchProcesses(busca).catch(() => []) : Promise.resolve([]),
    processoId ? getProcessDossier(processoId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Detalhamento do processo"
        subtitle="Licitação, contrato, itens e tramitação — do protocolo ao último despacho"
      />

      <TabNav tabs={abas("processo")} />

      <FilterBar base="/processos/relatorios/processo" ativo={Boolean(busca)} acao="Procurar">
        <FilterField label="Procurar processo" htmlFor="busca" largo>
          <input id="busca"
            type="search"
            name="busca"
            defaultValue={busca}
            placeholder="Número do processo, protocolo ou objeto" />
        </FilterField>
      </FilterBar>

      {/* Achou mas ainda não escolheu: a lista fica; escolhido, ela sai de cena
          e o dossiê ocupa a tela. */}
      {encontrados.length > 0 && !dossie ? (
        <Card title={`${encontrados.length} processo(s)`} padded={false}>
          <Table
            columns={["Processo", "Protocolo", "Descrição", "Aberto em"]}
            isEmpty={false}
            emptyMessage=""
          >
            {encontrados.map((achado) => (
              <tr key={achado.id}>
                <td>
                  <Link
                    href={`/processos/relatorios/processo?busca=${encodeURIComponent(busca)}&processo=${achado.id}`}
                    style={{ color: "var(--acao)" }}
                  >
                    <strong>{achado.numeroProcessoAdm}</strong>
                  </Link>
                </td>
                <td>{achado.numeroProtocolo}</td>
                <td className={celulaLonga}>{achado.descricao}</td>
                <td>{achado.dataAbertura}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      {busca.trim().length >= 2 && encontrados.length === 0 && !dossie ? (
        <Alert tone="info">Nada encontrado com esse texto.</Alert>
      ) : null}

      {!busca && !dossie ? (
        <Alert tone="info">
          Procure pelo número do processo, pelo protocolo ou por parte do objeto.
        </Alert>
      ) : null}

      {dossie ? (
        <Stack>
          <Card title={`Processo ${dossie.processo.numeroProcessoAdm}`}>
            <SummaryGrid
              items={[
                { label: "Protocolo", value: dossie.processo.numeroProtocolo },
                { label: "Situação", value: humanize(dossie.processo.status) },
                { label: "Tipo", value: humanize(dossie.processo.tipo) },
                { label: "Aberto em", value: dossie.processo.dataAbertura },
                { label: "Encerrado em", value: dossie.processo.dataEncerramento ?? "—" },
                { label: "Setor atual", value: dossie.processo.setorAtual ?? "—" },
                { label: "Unidade", value: dossie.processo.unidadeSolicitante ?? "—" },
                ...(dossie.processo.descricaoPedido
                  ? [{ label: "Descrição", value: dossie.processo.descricaoPedido, wide: true }]
                  : []),
              ]}
            />
          </Card>

          {dossie.contrato ? (
            <Card title="Contrato e origem">
              <SummaryGrid
                items={[
                  { label: "Contrato", value: dossie.contrato.numero },
                  { label: "Fornecedor", value: dossie.contrato.fornecedor },
                  { label: "CNPJ/CPF", value: dossie.contrato.documento },
                  {
                    label: "Vigência",
                    value: `${dossie.contrato.dataInicio} a ${dossie.contrato.dataFim ?? "sem termo"}`,
                  },
                  { label: "Valor do contrato", value: toCurrency(dossie.contrato.valorTotal) },
                  ...(dossie.origem
                    ? [
                      {
                        label: dossie.origem.tipo === "ATA" ? "Ata" : "Licitação",
                        value: dossie.origem.numero,
                      },
                      {
                        label: "Modalidade",
                        value: dossie.origem.modalidade
                          ? bidModalityLabel(dossie.origem.modalidade)
                          : "—",
                      },
                      { label: "Valor da origem", value: toCurrency(dossie.origem.valorTotal) },
                    ]
                    : []),
                  { label: "Objeto", value: dossie.contrato.objeto || "—", wide: true },
                ]}
              />
            </Card>
          ) : (
            <Alert tone="info">
              Este processo não tem contrato vinculado — é um processo de balcão, ou ainda não
              chegou à fase de compra.
            </Alert>
          )}

          {dossie.itens.length > 0 ? (
            <Card title={`Itens solicitados (${dossie.itens.length})`} padded={false}>
              <Table
                columns={["Produto", "Solicitado", "Valor", "Saldo do contrato"]}
                isEmpty={false}
                emptyMessage=""
              >
                <LinhasPorCategoria itens={dossie.itens} colunas={4}>
                  {(item) => (
                    <tr key={`${item.produto}-${item.quantidadeSolicitada}`}>
                      <td className={celulaLonga}>{item.produto}</td>
                      <td className={numericCell}>
                        {item.quantidadeSolicitada.toLocaleString("pt-BR")} {item.unidadeMedida}
                      </td>
                      <td className={numericCell}>{toCurrency(item.valorCalculado)}</td>
                      <td className={numericCell}>
                        {item.saldoDisponivel.toLocaleString("pt-BR")} {item.unidadeMedida}
                      </td>
                    </tr>
                  )}
                </LinhasPorCategoria>
              </Table>
            </Card>
          ) : null}

          <Card title={`Tramitação (${dossie.tramitacao.length})`} padded={false}>
            <Table
              columns={["Quando", "Setor", "Quem", "Ato", "Dias no setor"]}
              isEmpty={dossie.tramitacao.length === 0}
              emptyMessage="O processo ainda não foi despachado."
            >
              {dossie.tramitacao.map((passo, indice) => (
                <tr key={`${passo.data}-${indice}`}>
                  <td>{passo.data}</td>
                  <td>{passo.setor}</td>
                  <td>{passo.usuario}</td>
                  <td className={celulaLonga}>
                    <Badge tone="neutral">{humanize(passo.tipo)}</Badge>
                    {passo.texto ? (
                      <>
                        <br />
                        <small>{passo.texto}</small>
                      </>
                    ) : null}
                  </td>
                  <td className={numericCell}>{passo.diasNoSetor}</td>
                </tr>
              ))}
            </Table>
          </Card>

          {dossie.ordens.length > 0 ? (
            <Card title={`Ordens de fornecimento (${dossie.ordens.length})`} padded={false}>
              <Table
                columns={["Ordem", "Data", "Valor", "Empenho", "Nota fiscal"]}
                isEmpty={false}
                emptyMessage=""
              >
                {dossie.ordens.map((ordem) => (
                  <tr key={ordem.numero}>
                    <td>{ordem.numero}</td>
                    <td>{ordem.data}</td>
                    <td className={numericCell}>{toCurrency(ordem.valor)}</td>
                    <td>{ordem.numeroEmpenho ?? "—"}</td>
                    <td>{ordem.numeroNotaFiscal ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          ) : null}

          <Card title={`Peças emitidas (${dossie.documentos.length})`} padded={false}>
            <Table
              columns={["Documento", "Código", "Emitido por", "Quando"]}
              isEmpty={dossie.documentos.length === 0}
              emptyMessage="Nenhuma peça emitida sobre este processo."
            >
              {dossie.documentos.map((documento) => (
                <tr key={documento.id}>
                  <td>
                    <Link href={`/documentos/${documento.id}`} style={{ color: "var(--acao)" }}>
                      {documento.titulo}
                    </Link>
                  </td>
                  <td>{documento.codigo}</td>
                  <td>{documento.emitidoPor}</td>
                  <td>{documento.data}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </Stack>
      ) : null}
    </>
  );
}
