import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  getLetterhead, getTenant, listEntityAdmins, listPromotableUsers, listTenantSectors,
  listTenantUnits, listTenantUsers,
} from "@/features/system-admin/queries";
import { EntityAdminForm } from "@/features/system-admin/components/EntityAdminForm";
import { EntityAdminsPanel } from "@/features/system-admin/components/EntityAdminsPanel";
import { LetterheadForm } from "@/features/system-admin/components/LetterheadForm";
import { ModulesForm } from "@/features/system-admin/components/ModulesForm";
import { TenantRegistriesPanel } from "@/features/system-admin/components/TenantRegistriesPanel";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDocument } from "@/shared/ui/labels";

type TenantPageProps = { params: Promise<{ id: string }> };

export default async function TenantPage({ params }: TenantPageProps) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  const [letterhead, admins, promotable, units, sectors, users] = await Promise.all([
    getLetterhead(id),
    listEntityAdmins(id),
    listPromotableUsers(id),
    listTenantUnits(id),
    listTenantSectors(id),
    listTenantUsers(id),
  ]);

  return (
    <>
      <Link href="/admin">
        <Button type="button" variant="ghost">
          <ChevronLeft size={15} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
          Prefeituras
        </Button>
      </Link>

      <PageHeader
        title={tenant.nome}
        subtitle={`${tenant.municipio}/${tenant.uf} · ${toDocument(tenant.cnpj)}`}
        action={
          <span style={{ display: "inline-flex", gap: "8px" }}>
            <ModalTrigger
              label="Módulos"
              title={`Módulos de ${tenant.nome}`}
              description="Define o que aparece no hub dos servidores desta prefeitura."
            >
              <ModulesForm tenant={tenant} />
            </ModalTrigger>

            <ModalTrigger
              label="Timbre"
              title={`Documentos de ${tenant.nome}`}
              description="Cabeçalho, rodapé e logomarca dos documentos emitidos."
            >
              <LetterheadForm tenant={tenant} letterhead={letterhead} />
            </ModalTrigger>
          </span>
        }
      />

      <Card title="Administradores da prefeitura">
        <div style={{ marginBottom: "12px" }}>
          <ModalTrigger
            label="Novo administrador"
            title={`Novo administrador de ${tenant.nome}`}
            description="Cria um usuário com papel ADMIN."
          >
            <EntityAdminForm tenant={tenant} />
          </ModalTrigger>
        </div>

        <EntityAdminsPanel
          tenantId={tenant.id}
          tenantName={tenant.nome}
          admins={admins}
          promotable={promotable}
        />
      </Card>

      <Card title="Cadastros da prefeitura">
        <TenantRegistriesPanel
          tenantId={tenant.id}
          units={units}
          sectors={sectors}
          users={users}
        />
      </Card>
    </>
  );
}
