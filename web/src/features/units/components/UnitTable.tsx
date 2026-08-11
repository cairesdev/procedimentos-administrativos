import { Badge, Table } from "@/shared/ui/layout";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteUnit, setUnitActive } from "../actions";
import { UnitForm } from "./UnitForm";
import type { Unit } from "../types";

export const UnitTable = ({ units, canWrite }: { units: Unit[]; canWrite: boolean }) => (
  <Table
    columns={canWrite ? ["Nome", "Sigla", "Situação", ""] : ["Nome", "Sigla", "Situação"]}
    isEmpty={units.length === 0}
    emptyMessage="Nenhuma unidade cadastrada."
  >
    {units.map((unit) => (
      <tr key={unit.id}>
        <td>{unit.nome}</td>
        <td>{unit.sigla ?? "—"}</td>
        <td>
          <Badge tone={unit.ativo ? "success" : "neutral"}>
            {unit.ativo ? "ativa" : "inativa"}
          </Badge>
        </td>
        {canWrite ? (
          <td>
            <RowActions
              label={unit.nome}
              editTitle="Editar unidade"
              editForm={<UnitForm unit={unit} />}
              isActive={unit.ativo}
              onToggleActive={setUnitActive.bind(null, unit.id, !unit.ativo)}
              onDelete={deleteUnit.bind(null, unit.id)}
              deleteWarning="Unidades usadas em contratos, licitações ou solicitações não podem ser excluídas — inative."
            />
          </td>
        ) : null}
      </tr>
    ))}
  </Table>
);
