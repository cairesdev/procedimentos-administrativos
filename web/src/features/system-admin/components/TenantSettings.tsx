import { getLetterhead, listEntityAdmins, listPromotableUsers } from "../queries";
import { EntityAdminForm } from "./EntityAdminForm";
import { EntityAdminsPanel } from "./EntityAdminsPanel";
import { LetterheadForm } from "./LetterheadForm";
import { ModulesForm } from "./ModulesForm";
import { Card } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import type { Tenant } from "../types";
import styles from "./TenantSettings.module.css";

export const TenantSettings = async ({ tenant }: { tenant: Tenant }) => {
  const [letterhead, admins, promotable] = await Promise.all([
    getLetterhead(tenant.id),
    listEntityAdmins(tenant.id),
    listPromotableUsers(tenant.id),
  ]);

  const semAdminAtivo = admins.every((admin) => !admin.ativo);

  return (
    <Card title={tenant.nome}>
      <div className={styles.actions}>
        <ModalTrigger
          label="Módulos"
          title={`Módulos de ${tenant.nome}`}
          description="Define o que aparece no menu dos servidores desta prefeitura."
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

      <p className={styles.summary}>
        {tenant.usuarios} {tenant.usuarios === 1 ? "usuário" : "usuários"} ·{" "}
        {tenant.modulos.length} {tenant.modulos.length === 1 ? "módulo" : "módulos"} ·{" "}
        {letterhead.cabecalhoTimbre ? "timbre configurado" : "sem timbre"} ·{" "}
        {semAdminAtivo
          ? "sem administrador ativo"
          : `${admins.filter((admin) => admin.ativo).length} admin(s)`}
      </p>
    </Card>
  );
};
