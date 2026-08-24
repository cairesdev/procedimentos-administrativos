import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listAuditRecords } from "@/features/audit/queries";
import { AuditTable } from "@/features/audit/components/AuditTable";
import { EVENT_GROUPS, EVENT_LABELS } from "@/features/audit/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Toolbar } from "@/shared/ui/layout";

type AuditPageProps = {
  searchParams: Promise<{ tipo?: string; desde?: string; ate?: string; pagina?: string }>;
};

const POR_PAGINA = 50;

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

  const paginaAtual = Math.max(0, Number(pagina ?? 0) || 0);

  // Pede um a mais que o tamanho da página só para saber se existe próxima.
  const registros = await listAuditRecords({
    tipo,
    desde: inicio.toISOString(),
    ate: fim.toISOString(),
    limite: POR_PAGINA + 1,
    deslocamento: paginaAtual * POR_PAGINA,
  });

  const temProxima = registros.length > POR_PAGINA;
  const visiveis = temProxima ? registros.slice(0, POR_PAGINA) : registros;

  const filtroAtual = new URLSearchParams();
  if (tipo) filtroAtual.set("tipo", tipo);
  filtroAtual.set("desde", inicioTexto);
  filtroAtual.set("ate", fimTexto);

  const linkPagina = (numero: number) => {
    const query = new URLSearchParams(filtroAtual);
    query.set("pagina", String(numero));
    return `/processos/auditoria?${query}`;
  };

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Quem fez o quê, quando — de todos os módulos desta prefeitura"
      />

      {/* Formulário GET: o filtro fica na URL e sobrevive ao recarregar. */}
      <form method="get">
        <Toolbar>
          <select name="tipo" defaultValue={tipo ?? ""} aria-label="Tipo de evento">
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

          <label style={{ fontSize: "13px" }}>
            De{" "}
            <input type="date" name="desde" defaultValue={inicioTexto} style={{ marginLeft: "4px" }} />
          </label>
          <label style={{ fontSize: "13px" }}>
            Até{" "}
            <input type="date" name="ate" defaultValue={fimTexto} style={{ marginLeft: "4px" }} />
          </label>

          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </Toolbar>
      </form>

      <Alert tone="info">
        A trilha registra só eventos de negócio — não guarda edição simples de cadastro. Cada linha
        é definitiva: nada aqui é editado ou apagado pelo sistema.
      </Alert>

      <Card
        title={
          paginaAtual === 0 && !temProxima
            ? `${visiveis.length} registros`
            : `Página ${paginaAtual + 1}`
        }
        padded={false}
      >
        <AuditTable records={visiveis} />
      </Card>

      {paginaAtual > 0 || temProxima ? (
        <Toolbar>
          {paginaAtual > 0 ? (
            <Link href={linkPagina(paginaAtual - 1)}>
              <Button type="button" variant="secondary">
                <ChevronLeft size={15} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
                Anterior
              </Button>
            </Link>
          ) : null}

          {temProxima ? (
            <Link href={linkPagina(paginaAtual + 1)}>
              <Button type="button" variant="secondary">
                Próxima
                <ChevronRight size={15} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
              </Button>
            </Link>
          ) : null}
        </Toolbar>
      ) : null}
    </>
  );
}
