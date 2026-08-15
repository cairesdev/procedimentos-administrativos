import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DepartmentForm } from "@/features/sectors/components/DepartmentForm";
import { DepartmentTable } from "@/features/sectors/components/DepartmentTable";
import { findSector, listDepartments, listSectors } from "@/features/sectors/queries";
import { requirePermission } from "@/shared/auth/guards";
import { humanize } from "@/shared/ui/labels";
import { Badge, Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

type SectorPageProps = { params: Promise<{ id: string }> };

export default async function SectorDetailPage({ params }: SectorPageProps) {
  const viewer = await requirePermission("sectors:read");
  const { id } = await params;

  const [sector, sectors, departments] = await Promise.all([
    findSector(id),
    listSectors(),
    listDepartments(id),
  ]);

  if (!sector) notFound();

  const canWrite = viewer.can("sectors:write");

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/administracao/setores"
          style={{
            color: "var(--texto_suave)",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Setores
        </Link>
      </p>

      <PageHeader
        title={sector.nome}
        subtitle="Departamentos podem ser destino direto de uma etapa do fluxo"
        action={
          canWrite ? (
            <ModalTrigger label="Novo departamento" title="Novo departamento">
              <DepartmentForm sectors={sectors} sectorId={sector.id} />
            </ModalTrigger>
          ) : null
        }
      />

      <div style={{ marginBottom: "14px", display: "flex", gap: "8px" }}>
        <Badge tone="accent">{humanize(sector.tipo)}</Badge>
        <Badge tone={sector.ativo ? "success" : "neutral"}>
          {sector.ativo ? "ativo" : "inativo"}
        </Badge>
      </div>

      <Card title={`${departments.length} departamentos`} padded={false}>
        <DepartmentTable
          departments={departments}
          sector={sector}
          sectors={sectors}
          canWrite={canWrite}
        />
      </Card>
    </>
  );
}
