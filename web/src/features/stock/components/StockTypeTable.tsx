import { Badge, Table } from "@/shared/ui/layout";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteStockType } from "../actions";
import { StockTypeForm } from "./StockTypeForm";
import type { StockType } from "../types";

export const StockTypeTable = ({
  types,
  canWrite,
}: {
  types: StockType[];
  canWrite: boolean;
}) => {
  const colunas = ["Tipo", "Entradas classificadas", "Situação"];

  return (
    <Table
      columns={canWrite ? [...colunas, ""] : colunas}
      isEmpty={types.length === 0}
      emptyMessage="Nenhum tipo cadastrado. Toda entrada precisa de um."
    >
      {types.map((type) => (
        <tr key={type.id}>
          <td>
            <strong>{type.nome}</strong>
          </td>
          <td>{type.remessas}</td>
          <td>
            <Badge tone={type.ativo ? "success" : "neutral"}>
              {type.ativo ? "ativo" : "inativo"}
            </Badge>
          </td>
          {canWrite ? (
            <td>
              <RowActions
                label={type.nome}
                editTitle="Editar tipo de estoque"
                editForm={<StockTypeForm stockType={type} />}
                onDelete={deleteStockType.bind(null, type.id)}
                deleteWarning="Tipo que classifica alguma entrada não pode ser excluído — apagar tiraria a classificação do histórico. Desative."
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
