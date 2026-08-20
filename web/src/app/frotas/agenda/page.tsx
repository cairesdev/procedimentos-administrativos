import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSchedule } from "@/features/fleet/queries";
import { ScheduleGrid } from "@/features/fleet/components/ScheduleGrid";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader, Toolbar } from "@/shared/ui/layout";

type SchedulePageProps = {
  /** `semana` = domingo em YYYY-MM-DD; ausente, é a semana corrente. */
  searchParams: Promise<{ semana?: string }>;
};

const soData = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;

// Domingo da semana que contém a data, à meia-noite local.
const domingoDaSemana = (referencia: Date): Date => {
  const data = new Date(referencia);
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() - data.getDay());
  return data;
};

const somarDias = (data: Date, dias: number): Date => {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
};

const intervalo = (inicio: Date, fim: Date) =>
  `${inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${fim.toLocaleDateString(
    "pt-BR",
    { day: "2-digit", month: "short", year: "numeric" },
  )}`;

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  await requirePermission("fleet:read", "FROTAS");
  const { semana } = await searchParams;

  // "2026-08-23" vira meia-noite LOCAL; sem o T00:00:00 o JS lê como UTC e a
  // semana escorrega um dia para trás no nosso fuso.
  const referencia = semana ? new Date(`${semana}T00:00:00`) : new Date();
  const inicio = domingoDaSemana(Number.isNaN(referencia.valueOf()) ? new Date() : referencia);
  const fim = somarDias(inicio, 7);

  const rows = await getSchedule(inicio.toISOString(), fim.toISOString());

  const anterior = soData(somarDias(inicio, -7));
  const proxima = soData(somarDias(inicio, 7));
  const estaSemana = soData(domingoDaSemana(new Date())) === soData(inicio);

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Quem está com cada veículo, dia a dia"
      />

      <Toolbar>
        <Link href={`/frotas/agenda?semana=${anterior}`}>
          <Button type="button" variant="secondary">
            <ChevronLeft size={15} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
            Semana anterior
          </Button>
        </Link>

        <strong>{intervalo(inicio, somarDias(inicio, 6))}</strong>

        <Link href={`/frotas/agenda?semana=${proxima}`}>
          <Button type="button" variant="secondary">
            Próxima semana
            <ChevronRight size={15} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
          </Button>
        </Link>

        {estaSemana ? null : (
          <Link href="/frotas/agenda">
            <Button type="button" variant="ghost">
              Voltar para hoje
            </Button>
          </Link>
        )}
      </Toolbar>

      <Card padded={false}>
        {rows.length === 0 ? (
          <p style={{ padding: "20px" }}>Nenhum veículo cadastrado ainda.</p>
        ) : (
          <div style={{ padding: "16px" }}>
            <ScheduleGrid rows={rows} weekStart={inicio} />
          </div>
        )}
      </Card>
    </>
  );
}
