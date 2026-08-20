import type { Option } from "@/shared/ui/form-field";
import { Badge, Table } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteDriver, setDriverActive } from "../actions";
import { DriverForm } from "./DriverForm";
import type { Driver } from "../types";

// Vencida barra a escala na API; 30 dias é só aviso na tela.
const cnh = (dias: number) => {
  if (dias < 0) return { tone: "warning" as const, texto: `vencida há ${Math.abs(dias)} dia(s)` };
  if (dias <= 30) return { tone: "warning" as const, texto: `vence em ${dias} dia(s)` };
  return { tone: "success" as const, texto: "em dia" };
};

export const DriverTable = ({
  drivers,
  users,
  canWrite,
}: {
  drivers: Driver[];
  users: Option[];
  canWrite: boolean;
}) => {
  const columns = ["Nome", "CNH", "Categoria", "Validade", "Situação"];

  return (
    <Table
      columns={canWrite ? [...columns, ""] : columns}
      isEmpty={drivers.length === 0}
      emptyMessage="Nenhum motorista cadastrado."
    >
      {drivers.map((driver) => {
        const validade = cnh(driver.diasParaVencerCnh);
        return (
          <tr key={driver.id}>
            <td>{driver.nome}</td>
            <td>{driver.cnh}</td>
            <td>{driver.categoriaCnh}</td>
            <td>
              {toDate(driver.validadeCnh)}
              <br />
              <Badge tone={validade.tone}>{validade.texto}</Badge>
            </td>
            <td>
              <Badge tone={driver.ativo ? "success" : "neutral"}>
                {driver.ativo ? "ativo" : "inativo"}
              </Badge>
            </td>
            {canWrite ? (
              <td>
                <RowActions
                  label={driver.nome}
                  editTitle="Editar motorista"
                  editForm={<DriverForm driver={driver} users={users} />}
                  isActive={driver.ativo}
                  onToggleActive={setDriverActive.bind(null, driver.id, !driver.ativo)}
                  onDelete={deleteDriver.bind(null, driver.id)}
                  deleteWarning="Motoristas com viagens registradas não podem ser excluídos — inative."
                />
              </td>
            ) : null}
          </tr>
        );
      })}
    </Table>
  );
};
