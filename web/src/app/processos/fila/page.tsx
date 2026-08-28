import Link from "next/link";
import { listClosedProcesses, listProcesses } from "@/features/processes/queries";
import { ProcessTable } from "@/features/processes/components/ProcessTable";
import { getActiveAssignmentId, getProfile } from "@/features/auth/queries";
import { listSectors } from "@/features/sectors/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";
import { Pagination } from "@/shared/ui/Pagination";

type ProcessQueuePageProps = {
  searchParams: Promise<{ pagina?: string; aba?: string }>;
};

export default async function ProcessQueuePage({ searchParams }: ProcessQueuePageProps) {
  await requirePermission("processes:read", "PROCESSOS");
  const { pagina, aba } = await searchParams;

  const [profile, activeAssignmentId, sectors] = await Promise.all([
    getProfile(),
    getActiveAssignmentId(),
    listSectors(),
  ]);

  // A fila mostra o setor da lotação ativa; sem lotação de setor, mostra tudo.
  const active = profile.lotacoes.find((assignment) => assignment.id === activeAssignmentId)
    ?? profile.lotacoes[0];
  const sectorId = active?.setorId ?? undefined;

  /**
   * Encerrado não está em setor nenhum, então a aba pergunta "passou por
   * aqui?" — existe despacho deste setor no processo. Quem atuou numa etapa
   * continua alcançando o processo depois de ele sair de circulação.
   */
  const encerrados = aba === "encerrados";
  const [fila, arquivo] = await Promise.all([
    encerrados ? null : listProcesses(sectorId, pagina),
    encerrados ? listClosedProcesses(sectorId, pagina) : null,
  ]);

  const sectorName = sectors.find((sector) => sector.id === sectorId)?.nome;
  // Os contadores vêm da API e falam da fila inteira — somar a página mostraria
  // menos atraso do que existe justamente na tela que serve para alertar.
  const { atrasados, vencendo } = fila ?? { atrasados: 0, vencendo: 0 };

  return (
    <>
      <PageHeader
        title="Fila do setor"
        subtitle={
          sectorName
            ? `Processos ${encerrados ? "que passaram por" : "aguardando ação em"} ${sectorName}`
            : `Todos os processos ${encerrados ? "encerrados" : "em andamento"} nesta prefeitura`
        }
      />

      <nav style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        {[
          { rotulo: "Em andamento", href: "/processos/fila", ativa: !encerrados },
          { rotulo: "Encerrados", href: "/processos/fila?aba=encerrados", ativa: encerrados },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              textDecoration: "none",
              background: item.ativa ? "var(--acao_suave)" : "transparent",
              color: item.ativa ? "var(--acao)" : "var(--texto_suave)",
              fontWeight: item.ativa ? 600 : 400,
            }}
          >
            {item.rotulo}
          </Link>
        ))}
      </nav>

      {!encerrados && (atrasados > 0 || vencendo > 0) ? (
        <div style={{ marginBottom: "14px" }}>
          <Alert tone={atrasados > 0 ? "error" : "info"}>
            {atrasados > 0
              ? `${atrasados} ${atrasados === 1 ? "processo passou" : "processos passaram"} do prazo da etapa.`
              : null}{" "}
            {vencendo > 0
              ? `${vencendo} ${vencendo === 1 ? "vence" : "vencem"} nos próximos dias.`
              : null}{" "}
            A lista já vem ordenada pelos mais urgentes.
          </Alert>
        </div>
      ) : null}

      {sectorId || encerrados ? null : (
        <div style={{ marginBottom: "14px" }}>
          <Alert tone="info">
            Sua lotação ativa não é de setor, então a lista mostra todos os processos abertos.
          </Alert>
        </div>
      )}

      {arquivo ? (
        <Card title={`${arquivo.total} encerrados`} padded={false}>
          <ProcessTable
            processes={arquivo.itens}
            sectors={sectors}
            limiarAlertaDias={0}
            vazio={
              sectorName
                ? `Nenhum processo encerrado passou por ${sectorName}.`
                : "Nenhum processo encerrado nesta prefeitura."
            }
          />
          <Pagination info={arquivo} base="/processos/fila" filtros={{ aba: "encerrados" }} />
        </Card>
      ) : (
        <Card title={`${fila!.total} em andamento`} padded={false}>
          <ProcessTable
            processes={fila!.itens}
            sectors={sectors}
            limiarAlertaDias={fila!.limiarAlertaDias}
          />
          <Pagination info={fila!} base="/processos/fila" />
        </Card>
      )}
    </>
  );
}
