import { Badge, Table } from "@/shared/ui/layout";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteDepartment } from "../actions";
import { DepartmentForm } from "./DepartmentForm";
import type { Department, Sector } from "../types";

export const DepartmentTable = ({
  departments,
  sector,
  sectors,
  canWrite,
}: {
  departments: Department[];
  sector: Sector;
  sectors: Sector[];
  canWrite: boolean;
}) => (
  <Table
    columns={
      canWrite ? ["Nome", "Categoria", "Situação", ""] : ["Nome", "Categoria", "Situação"]
    }
    isEmpty={departments.length === 0}
    emptyMessage="Nenhum departamento neste setor."
  >
    {departments.map((department) => (
      <tr key={department.id}>
        <td>{department.nome}</td>
        <td>{department.categoriaAtendimento ?? "—"}</td>
        <td>
          <Badge tone={department.ativo ? "success" : "neutral"}>
            {department.ativo ? "ativo" : "inativo"}
          </Badge>
        </td>
        {canWrite ? (
          <td>
            <RowActions
              label={department.nome}
              editTitle="Editar departamento"
              editForm={
                <DepartmentForm
                  sectors={sectors}
                  department={department}
                  sectorId={sector.id}
                />
              }
              onDelete={deleteDepartment.bind(null, sector.id, department.id)}
              deleteWarning="Departamentos com processos, despachos, lotações ou etapas de fluxo não podem ser excluídos."
            />
          </td>
        ) : null}
      </tr>
    ))}
  </Table>
);
