import { getBySector } from "@/features/reports/queries";
import { mesCorrente, ReportFilterBar } from "@/features/reports/components/ReportFilterBar";
import { EmitirRelatorio } from "@/features/reports/components/EmitirRelatorio";
import { listSectors } from "@/features/sectors/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";
import { TabNav } from "@/shared/ui/TabNav";

type Props = {
  searchParams: Promise<{ inicio?: string; fim?: string; setor?: string }>;
};

/** Um processo parado há mais de duas semanas é o que se quer enxergar. */
const LIMIAR_DE_ATENCAO = 15;

/**
 * Onde o processo trava.
 *
 * Quantos entraram no setor no período, quantos saíram, quantos ainda estão lá
 * e há quantos dias está o mais antigo. O tempo sai dos despachos: da entrada
 * no setor até a saída, ou até hoje quando o processo não saiu.
 *
 * Sem valor, de propósito. Quem quer saber quanto um setor movimentou está
 * fazendo a pergunta do panorama, com outro recorte.
 */
export default async function RelatorioPorSetorPage({ searchParams }: Props) {
  await requirePermission("reports:read", "PROCESSOS");
  const filtros = await searchParams;

  const padrao = mesCorrente();
  const inicio = filtros.inicio || padrao.inicio;
  const fim = filtros.fim || padrao.fim;
  const recorte = { inicio, fim, setor: filtros.setor };

  const [apuracao, setores] = await Promise.all([
    getBySector(recorte).catch(() => null),
    listSectors().catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Tramitação por setor"
        subtitle="Quantos processos passaram, quantos ficaram, e há quanto tempo"
        action={apuracao ? <EmitirRelatorio tipo="SETOR" filtros={recorte} /> : null}
      />

      <TabNav
        tabs={[
          { rotulo: "Panorama", href: "/processos/relatorios", ativa: false },
          { rotulo: "Por setor", href: "/processos/relatorios/setor", ativa: true },
          { rotulo: "Processo", href: "/processos/relatorios/processo", ativa: false },
        ]}
      />

      <ReportFilterBar inicio={inicio} fim={fim}>
        <select name="setor" defaultValue={filtros.setor ?? ""} aria-label="Setor">
          <option value="">Todos os setores</option>
          {setores.map((setor) => (
            <option key={setor.id} value={setor.id}>{setor.nome}</option>
          ))}
        </select>
      </ReportFilterBar>

      {!apuracao ? (
        <Alert tone="error">
          Não foi possível apurar o relatório. Confira o período: o fim não pode ser anterior ao
          início.
        </Alert>
      ) : (
        <Stack>
          <Card title="No período">
            <SummaryGrid
              items={[
                { label: "Entraram", value: `${apuracao.totais.entraram}` },
                { label: "Saíram", value: `${apuracao.totais.sairam}` },
                { label: "Ainda no setor", value: `${apuracao.totais.parados}` },
              ]}
            />
          </Card>

          <Alert tone="info">
            <strong>&quot;Ainda no setor&quot; é sobre agora</strong>, e não sobre o período: são os
            processos que estão parados hoje, tenham chegado quando tiverem chegado.
          </Alert>

          <Card title={`${apuracao.setores.length} setores com movimento`} padded={false}>
            <Table
              columns={[
                "Setor", "Entraram", "Saíram", "Ainda no setor",
                "Dias em média", "Parado há mais tempo",
              ]}
              isEmpty={apuracao.setores.length === 0}
              emptyMessage="Nenhum processo passou por setor nenhum neste período."
            >
              {apuracao.setores.map((setor) => (
                <tr key={setor.id}>
                  <td><strong>{setor.nome}</strong></td>
                  <td className={numericCell}>{setor.entraram}</td>
                  <td className={numericCell}>{setor.sairam}</td>
                  <td className={numericCell}>{setor.parados}</td>
                  <td className={numericCell}>
                    {setor.sairam > 0 ? `${setor.diasMedia}` : "—"}
                  </td>
                  <td className={numericCell}>
                    {setor.parados === 0 ? (
                      "—"
                    ) : setor.diasMaisAntigo >= LIMIAR_DE_ATENCAO ? (
                      <Badge tone="warning">{setor.diasMaisAntigo} dias</Badge>
                    ) : (
                      `${setor.diasMaisAntigo} dias`
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </Stack>
      )}
    </>
  );
}
