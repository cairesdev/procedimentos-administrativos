import { Badge, Table } from "@/shared/ui/layout";
import type { Unit } from "../types";

export const UnitTable = ({ units }: { units: Unit[] }) => (
  <Table
    columns={["Nome", "Sigla", "Situação"]}
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
      </tr>
    ))}
  </Table>
);
