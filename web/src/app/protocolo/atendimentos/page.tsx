import Link from "next/link";
import { Plus } from "lucide-react";
import { listServiceRecords, listSubjects } from "@/features/protocol/queries";
import { ServiceTable } from "@/features/protocol/components/ServiceTable";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
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
      <FilterBar base="/protocolo/atendimentos" ativo={Boolean(busca || assunto || status)}>
        <FilterField label="Buscar atendimento" htmlFor="busca" largo>
          <input id="busca"
            type="search"
            name="busca"
            defaultValue={busca ?? ""}
            placeholder="Protocolo, nome ou documento" />
        </FilterField>

        <FilterField label="Assunto" htmlFor="assunto">
          <select id="assunto" name="assunto" defaultValue={assunto ?? ""}>
            <option value="">Todos os assuntos</option>
            {assuntos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Situação" htmlFor="status">
          <select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Todas as situações</option>
            <option value="ABERTO">Aberto</option>
            <option value="TRAMITANDO">Em tramitação</option>
            <option value="ENCERRADO">Encerrado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </FilterField>
      </FilterBar>

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
