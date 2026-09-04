import { listAuditRecords } from "@/features/audit/queries";
import { AuditTable } from "@/features/audit/components/AuditTable";
import { EVENT_GROUPS, EVENT_LABELS } from "@/features/audit/types";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { Pagination } from "@/shared/ui/Pagination";

type AuditPageProps = {
  searchParams: Promise<{ tipo?: string; desde?: string; ate?: string; pagina?: string }>;
};

const soData = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requirePermission("audit:read", "PROCESSOS");
  const { tipo, desde, ate, pagina } = await searchParams;

  // Padrão: últimos 30 dias. Trilha inteira desde o início não ajuda ninguém.
  const hoje = new Date();
  const trintaDias = new Date(hoje);
  trintaDias.setDate(trintaDias.getDate() - 30);

  const inicioTexto = desde || soData(trintaDias);
  const fimTexto = ate || soData(hoje);

  // "2026-08-01" sem hora seria lido como UTC e escorregaria um dia no nosso fuso.
  const inicio = new Date(`${inicioTexto}T00:00:00`);
  // O fim é exclusivo na API; somar um dia inclui o dia escolhido inteiro.
  const fim = new Date(`${fimTexto}T00:00:00`);
  fim.setDate(fim.getDate() + 1);

  const registros = await listAuditRecords({
    tipo,
    desde: inicio.toISOString(),
    ate: fim.toISOString(),
    pagina,
  });

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Quem fez o quê, quando — de todos os módulos desta prefeitura"
      />

      {/* Formulário GET: o filtro fica na URL e sobrevive ao recarregar. */}
      <FilterBar base="/processos/auditoria" ativo={Boolean(tipo || inicioTexto || fimTexto)}>
        <FilterField label="Tipo de evento" htmlFor="tipo">
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""}>
            <option value="">Todos os eventos</option>
            {EVENT_GROUPS.map((grupo) => (
              <optgroup key={grupo.group} label={grupo.group}>
                {grupo.events.map((evento) => (
                  <option key={evento} value={evento}>
                    {EVENT_LABELS[evento]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </FilterField>

        <FilterField label="Desde" htmlFor="desde">
          <input id="desde" type="date" name="desde" defaultValue={inicioTexto} />
        </FilterField>

        <FilterField label="Até" htmlFor="ate">
          <input id="ate" type="date" name="ate" defaultValue={fimTexto} />
        </FilterField>
      </FilterBar>

      <Alert tone="info">
        A trilha registra só eventos de negócio — não guarda edição simples de cadastro. Cada linha
        é definitiva: nada aqui é editado ou apagado pelo sistema.
      </Alert>

      <Card title={`${registros.total} registros`} padded={false}>
        <AuditTable records={registros.itens} />
        <Pagination
          info={registros}
          base="/processos/auditoria"
          filtros={{ tipo, desde: inicioTexto, ate: fimTexto }}
        />
      </Card>
    </>
  );
}
