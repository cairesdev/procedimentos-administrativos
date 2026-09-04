import Link from "next/link";
import { Plus } from "lucide-react";
import { listRequests } from "@/features/requests/queries";
import { RequestTable } from "@/features/requests/components/RequestTable";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { Pagination } from "@/shared/ui/Pagination";

type RequestsPageProps = {
  searchParams: Promise<{ situacao?: string; unidade?: string; pagina?: string }>;
};

export default async function RequestsPage({ searchParams }: RequestsPageProps) {
  const viewer = await requirePermission("requests:read", "PROCESSOS");
  const { situacao, unidade, pagina } = await searchParams;

  const [requests, units] = await Promise.all([
    listRequests({ situacao, unidade, pagina }),
    listUnits(),
  ]);

  return (
    <>
      <PageHeader
        title="Solicitações"
        subtitle="Pedidos de itens de contrato, do rascunho ao processo em tramitação"
        action={
          viewer.can("requests:create") ? (
            <Link href="/processos/solicitacoes/nova">
              <Button type="button">
                <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                Nova solicitação
              </Button>
            </Link>
          ) : null
        }
      />

      {/* Formulário GET: o filtro fica na URL e sobrevive ao recarregar. */}
      <FilterBar base="/processos/solicitacoes" ativo={Boolean(situacao || unidade)}>
        <FilterField label="Situação" htmlFor="situacao">
          <select id="situacao" name="situacao" defaultValue={situacao ?? ""}>
            <option value="">Rascunhos e enviadas</option>
            <option value="RASCUNHO">Só rascunhos</option>
            <option value="ENVIADA">Só enviadas</option>
          </select>
        </FilterField>

        <FilterField label="Unidade" htmlFor="unidade">
          <select id="unidade" name="unidade" defaultValue={unidade ?? ""}>
            <option value="">Todas as unidades</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.nome}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Card title={`${requests.total} solicitações`} padded={false}>
        <RequestTable requests={requests.itens} />
        <Pagination
          info={requests}
          base="/processos/solicitacoes"
          filtros={{ situacao, unidade }}
        />
      </Card>
    </>
  );
}
