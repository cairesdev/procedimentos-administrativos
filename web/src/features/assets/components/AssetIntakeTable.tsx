import { Table, numericCell } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import type { Supplier } from "@/features/suppliers/types";
import { deleteAssetIntake } from "../actions";
import { AssetIntakeForm } from "./AssetIntakeForm";
import type { AssetIntake } from "../types";

export const AssetIntakeTable = ({
  intakes,
  suppliers,
  canWrite,
}: {
  intakes: AssetIntake[];
  suppliers: Supplier[];
  canWrite: boolean;
}) => {
  const columns = ["Data", "Nota fiscal", "Fornecedor", "Bens tombados"];

  return (
    <Table
      columns={canWrite ? [...columns, ""] : columns}
      isEmpty={intakes.length === 0}
      emptyMessage="Nenhuma entrada registrada. Cadastre locais e categorias primeiro."
    >
      {intakes.map((intake) => (
        <tr key={intake.id}>
          <td>{toDate(intake.data)}</td>
          <td>{intake.notaFiscal ?? "—"}</td>
          <td>
            {suppliers.find((supplier) => supplier.id === intake.fornecedorId)?.razaoSocial ?? "—"}
          </td>
          <td className={numericCell}>{intake.bens}</td>
          {canWrite ? (
            <td>
              <RowActions
                label={`entrada de ${toDate(intake.data)}`}
                editTitle="Editar entrada"
                editForm={<AssetIntakeForm intake={intake} suppliers={suppliers} />}
                onDelete={deleteAssetIntake.bind(null, intake.id)}
                deleteWarning={`Apaga os ${intake.bens} bens tombados nesta entrada. Os números NÃO são reaproveitados — a sequência do local fica com buraco. Bloqueado se algum deles já foi conferido em inventário.`}
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
