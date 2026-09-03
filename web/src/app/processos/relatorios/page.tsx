import Link from "next/link";
import { getPanorama } from "@/features/reports/queries";
import { mesCorrente, ReportFilterBar } from "@/features/reports/components/ReportFilterBar";
import { EmitirRelatorio } from "@/features/reports/components/EmitirRelatorio";
import { listUnits } from "@/features/units/queries";
import { listSuppliers } from "@/features/suppliers/queries";
import { allOf } from "@/shared/api/pagination";
import { BID_MODALITIES, bidModalityLabel } from "@/features/bids/types";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader, Stack, SummaryGrid, Table, celulaLonga, numericCell } from "@/shared/ui/layout";
import { toCurrency } from "@/shared/ui/labels";
import { TabNav } from "@/shared/ui/TabNav";

type Props = {
  searchParams: Promise<{
    inicio?: string;
    fim?: string;
    unidade?: string;
    fornecedor?: string;
    modalidade?: string;
  }>;
};

/**
 * Panorama: o que a prefeitura contratou no período e quanto disso já saiu.
 *
 * Os filtros vivem na URL. O relatório é recalculado a cada abertura — assim o
 * endereço descreve a consulta e pode ser recarregado, compartilhado e reaberto
 * amanhã com os números de amanhã. Quem precisa do retrato de hoje emite a
 * peça, que congela os valores com timbre e código de conferência.
 */
export default async function PanoramaPage({ searchParams }: Props) {
  await requirePermission("reports:read", "PROCESSOS");
  const filtros = await searchParams;

  const padrao = mesCorrente();
  const inicio = filtros.inicio || padrao.inicio;
  const fim = filtros.fim || padrao.fim;
  const recorte = {
    inicio, fim,
    unidade: filtros.unidade,
    fornecedor: filtros.fornecedor,
    modalidade: filtros.modalidade,
  };

  const [panorama, unidades, fornecedores] = await Promise.all([
    getPanorama(recorte).catch(() => null),
    listUnits().catch(() => []),
    // O seletor precisa da lista inteira: um fornecedor fora da primeira
    // página sumiria do filtro sem avisar.
    allOf((pagina) => listSuppliers(undefined, String(pagina))).catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="O que foi contratado no período, de quem, e quanto disso já virou pedido"
        action={
          panorama ? <EmitirRelatorio tipo="PANORAMA" filtros={recorte} /> : null
        }
      />

      <TabNav
        tabs={[
          { rotulo: "Panorama", href: "/processos/relatorios", ativa: true },
          { rotulo: "Por setor", href: "/processos/relatorios/setor", ativa: false },
        ]}
      />

      <ReportFilterBar inicio={inicio} fim={fim}>
        <select name="unidade" defaultValue={filtros.unidade ?? ""} aria-label="Unidade">
          <option value="">Todas as unidades</option>
          {unidades.map((unidade) => (
            <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>
          ))}
        </select>
        <select name="fornecedor" defaultValue={filtros.fornecedor ?? ""} aria-label="Fornecedor">
          <option value="">Todos os fornecedores</option>
          {fornecedores.map((fornecedor) => (
            <option key={fornecedor.id} value={fornecedor.id}>{fornecedor.razaoSocial}</option>
          ))}
        </select>
        <select name="modalidade" defaultValue={filtros.modalidade ?? ""} aria-label="Modalidade">
          <option value="">Todas as modalidades</option>
          {BID_MODALITIES.map((modalidade) => (
            <option key={modalidade.id} value={modalidade.id}>
              {bidModalityLabel(modalidade.id)}
            </option>
          ))}
        </select>
      </ReportFilterBar>

      {!panorama ? (
        <Alert tone="error">
          Não foi possível apurar o relatório. Confira o período: o fim não pode ser anterior ao
          início.
        </Alert>
      ) : (
        <Stack>
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

          <Alert tone="info">
            <strong>Pedido não é pago.</strong> A coluna soma o que já virou solicitação; o sistema
            registra a ordem de fornecimento, não a liquidação do empenho.
          </Alert>

          <Card title={`Contratos (${panorama.contratos.length})`} padded={false}>
            <Table
              columns={["Contrato", "Fornecedor", "Objeto", "Contratado", "Pedido", "Saldo"]}
              isEmpty={panorama.contratos.length === 0}
              emptyMessage="Nenhum contrato firmado neste período."
            >
              {panorama.contratos.map((contrato) => (
                <tr key={contrato.id}>
                  <td>
                    <Link href={`/processos/contratos/${contrato.id}`} style={{ color: "var(--acao)" }}>
                      {contrato.numero}
                    </Link>
                    <br />
                    <small>{contrato.dataInicio} a {contrato.dataFim ?? "sem termo"}</small>
                  </td>
                  <td>{contrato.fornecedor}</td>
                  <td className={celulaLonga}>{contrato.objeto}</td>
                  <td className={numericCell}>{toCurrency(contrato.valorContratado)}</td>
                  <td className={numericCell}>{toCurrency(contrato.valorPedido)}</td>
                  <td className={numericCell}>{toCurrency(contrato.saldo)}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title={`Licitações (${panorama.licitacoes.length})`} padded={false}>
            <Table
              columns={["Licitação", "Modalidade", "Objeto", "Valor", "Contratos"]}
              isEmpty={panorama.licitacoes.length === 0}
              emptyMessage="Nenhuma licitação assinada neste período."
            >
              {panorama.licitacoes.map((licitacao) => (
                <tr key={licitacao.id}>
                  <td>
                    <Link href={`/processos/licitacoes/${licitacao.id}`} style={{ color: "var(--acao)" }}>
                      {licitacao.numero}
                    </Link>
                    <br />
                    <small>{licitacao.dataAssinatura}</small>
                  </td>
                  <td>{bidModalityLabel(licitacao.modalidade)}</td>
                  <td className={celulaLonga}>{licitacao.objeto}</td>
                  <td className={numericCell}>{toCurrency(licitacao.valorTotal)}</td>
                  <td className={numericCell}>{licitacao.contratos}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title={`Fornecedores (${panorama.fornecedores.length})`} padded={false}>
            <Table
              columns={["Fornecedor", "CNPJ/CPF", "Contratos", "Contratado", "Pedido"]}
              isEmpty={panorama.fornecedores.length === 0}
              emptyMessage="Nenhum fornecedor contratado neste período."
            >
              {panorama.fornecedores.map((fornecedor) => (
                <tr key={fornecedor.id}>
                  <td>{fornecedor.razaoSocial}</td>
                  <td>{fornecedor.documento}</td>
                  <td className={numericCell}>{fornecedor.contratos}</td>
                  <td className={numericCell}>{toCurrency(fornecedor.valorContratado)}</td>
                  <td className={numericCell}>{toCurrency(fornecedor.valorPedido)}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title={`Unidades (${panorama.unidades.length})`} padded={false}>
            <Table
              columns={["Unidade", "Contratos", "Processos", "Pedido"]}
              isEmpty={panorama.unidades.length === 0}
              emptyMessage="Nenhuma unidade cadastrada."
            >
              {panorama.unidades.map((unidade) => (
                <tr key={unidade.id}>
                  <td>{unidade.nome}</td>
                  <td className={numericCell}>{unidade.contratos}</td>
                  <td className={numericCell}>{unidade.processos}</td>
                  <td className={numericCell}>{toCurrency(unidade.valorPedido)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </Stack>
      )}
    </>
  );
}
