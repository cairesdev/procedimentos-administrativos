import { getLetterhead } from "../queries";
import { FirstAdminForm } from "./FirstAdminForm";
import { LetterheadForm } from "./LetterheadForm";
import { ModulesForm } from "./ModulesForm";
import { Card } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import type { Tenant } from "../types";
import styles from "./TenantSettings.module.css";

export const TenantSettings = async ({ tenant }: { tenant: Tenant }) => {
  const letterhead = await getLetterhead(tenant.id);

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
          label="Administrador"
          title={`Administrador de ${tenant.nome}`}
          description="Cria o primeiro usuário ADMIN, que depois cadastra os demais."
        >
          <FirstAdminForm tenant={tenant} />
        </ModalTrigger>
      </div>

      <p className={styles.summary}>
        {tenant.usuarios} {tenant.usuarios === 1 ? "usuário" : "usuários"} ·{" "}
        {tenant.modulos.length} {tenant.modulos.length === 1 ? "módulo" : "módulos"} ·{" "}
        {letterhead.cabecalhoTimbre ? "timbre configurado" : "sem timbre"}
      </p>
    </Card>
  );
};
