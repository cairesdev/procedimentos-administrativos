import { Badge, Table } from "@/shared/ui/layout";
import { toDocument } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import { setTenantActive } from "../actions";
import { TenantForm } from "./TenantForm";
import type { Tenant } from "../types";
import styles from "./TenantTable.module.css";

export const TenantTable = ({ tenants }: { tenants: Tenant[] }) => (
  <Table
    columns={["Prefeitura", "CNPJ", "Módulos", "Usuários", "Situação", ""]}
    isEmpty={tenants.length === 0}
    emptyMessage="Nenhuma prefeitura cadastrada."
  >
    {tenants.map((tenant) => (
      <tr key={tenant.id}>
        <td>
          <span className={styles.name}>{tenant.nome}</span>
          <span className={styles.place}>
            {tenant.municipio}/{tenant.uf}
          </span>
        </td>
        <td>{toDocument(tenant.cnpj)}</td>
        <td>
          <span className={styles.modules}>
            {tenant.modulos.length === 0 ? (
              <Badge>nenhum</Badge>
            ) : (
              tenant.modulos.map((module) => (
                <Badge key={module} tone="accent">
                  {module.toLowerCase()}
                </Badge>
              ))
            )}
          </span>
        </td>
        <td>{tenant.usuarios}</td>
        <td>
          <Badge tone={tenant.ativo ? "success" : "neutral"}>
            {tenant.ativo ? "ativa" : "inativa"}
          </Badge>
        </td>
        <td>
          <RowActions
            label={tenant.nome}
            editTitle="Editar prefeitura"
            editForm={<TenantForm tenant={tenant} />}
            isActive={tenant.ativo}
            onToggleActive={setTenantActive.bind(null, tenant.id, !tenant.ativo)}
          />
        </td>
      </tr>
    ))}
  </Table>
);
