import Link from "next/link";
import { Plus } from "lucide-react";
import { listServiceRecords, listSubjects } from "@/features/protocol/queries";
import { ServiceTable } from "@/features/protocol/components/ServiceTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { Pagination } from "@/shared/ui/Pagination";

type ProtocolPageProps = {
  searchParams: Promise<{ status?: string; assunto?: string; busca?: string; pagina?: string }>;
};

export default async function ProtocolPage({ searchParams }: ProtocolPageProps) {
  const viewer = await requirePermission("protocol:read", "PROTOCOLO");
  const { status, assunto, busca, pagina } = await searchParams;

  const [atendimentos, assuntos] = await Promise.all([
    listServiceRecords({ status, assunto, busca, pagina }),
    listSubjects(),
  ]);

  return (
    <>
      <PageHeader
        title="Protocolo externo"
        subtitle="Atendimentos abertos no balcão e pelo portal do cidadão"
        action={
          viewer.can("protocol:serve") ? (
            <Link href="/protocolo/atendimentos/novo">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Novo atendimento
              </Button>
            </Link>
          ) : null
        }
      />

      {/* Formulário GET: o filtro fica na URL e sobrevive ao recarregar. */}
      <form method="get">
        <Toolbar>
          <input
            type="search"
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Protocolo, nome ou documento"
            aria-label="Buscar atendimento"
          />

          <select name="assunto" defaultValue={assunto ?? ""} aria-label="Assunto">
            <option value="">Todos os assuntos</option>
            {assuntos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>

          <select name="status" defaultValue={status ?? ""} aria-label="Situação">
            <option value="">Todas as situações</option>
            <option value="ABERTO">Aberto</option>
            <option value="TRAMITANDO">Em tramitação</option>
            <option value="ENCERRADO">Encerrado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>

          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </Toolbar>
      </form>

      <Card title={`${atendimentos.total} atendimentos`} padded={false}>
        <ServiceTable records={atendimentos.itens} />
        <Pagination
          info={atendimentos}
          base="/protocolo/atendimentos"
          filtros={{ status, assunto, busca }}
        />
      </Card>
    </>
  );
}
