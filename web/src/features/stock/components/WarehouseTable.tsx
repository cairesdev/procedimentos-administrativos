import { Badge, Table } from "@/shared/ui/layout";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteWarehouse } from "../actions";
import { WarehouseForm } from "./WarehouseForm";
import type { Warehouse } from "../types";

export const WarehouseTable = ({
  warehouses,
  canWrite,
}: {
  warehouses: Warehouse[];
  canWrite: boolean;
}) => {
  const colunas = ["Almoxarifado", "Locais atendidos", "Entradas", "Situação"];

  return (
    <Table
      columns={canWrite ? [...colunas, ""] : colunas}
      isEmpty={warehouses.length === 0}
      emptyMessage="Nenhum almoxarifado cadastrado. Comece por aqui: entrada e pedido dependem dele."
    >
      {warehouses.map((warehouse) => (
        <tr key={warehouse.id}>
          <td>
            <strong>{warehouse.nome}</strong>
          </td>
          <td>{warehouse.locais}</td>
          <td>{warehouse.remessas}</td>
          <td>
            <Badge tone={warehouse.ativo ? "success" : "neutral"}>
              {warehouse.ativo ? "ativo" : "inativo"}
            </Badge>
          </td>
          {canWrite ? (
            <td>
              <RowActions
                label={warehouse.nome}
                editTitle="Editar almoxarifado"
                editForm={<WarehouseForm warehouse={warehouse} />}
                onDelete={deleteWarehouse.bind(null, warehouse.id)}
                deleteWarning="Só é possível excluir almoxarifado sem entrada e sem local vinculado. Com movimento, desative."
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
