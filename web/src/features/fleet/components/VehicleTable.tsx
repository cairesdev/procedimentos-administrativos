import type { Option } from "@/shared/ui/form-field";
import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteVehicle, setVehicleActive } from "../actions";
import { VehicleForm } from "./VehicleForm";
import type { Vehicle } from "../types";

const quilometragem = (valor: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(valor)} km`;

export const VehicleTable = ({
  vehicles,
  units,
  canWrite,
}: {
  vehicles: Vehicle[];
  units: Option[];
  canWrite: boolean;
}) => {
  const columns = ["Placa", "Modelo", "Ano", "Secretaria", "Hodômetro", "Situação"];

  return (
    <Table
      columns={canWrite ? [...columns, ""] : columns}
      isEmpty={vehicles.length === 0}
      emptyMessage="Nenhum veículo cadastrado."
    >
      {vehicles.map((vehicle) => (
        <tr key={vehicle.id}>
          <td>
            <strong>{vehicle.placa}</strong>
          </td>
          <td>
            {vehicle.modelo}
            {vehicle.tipo ? <br /> : null}
            {vehicle.tipo ? <small>{vehicle.tipo}</small> : null}
          </td>
          <td>{vehicle.ano ?? "—"}</td>
          <td>
            {units.find((unit) => unit.value === vehicle.unidadeId)?.label ?? "Frota central"}
          </td>
          <td className={numericCell}>{quilometragem(vehicle.quilometragemAtual)}</td>
          <td>
            {vehicle.emManutencao ? (
              <Badge tone="warning">em manutenção</Badge>
            ) : (
              <Badge tone={vehicle.ativo ? "success" : "neutral"}>
                {vehicle.ativo ? "disponível" : "inativo"}
              </Badge>
            )}
          </td>
          {canWrite ? (
            <td>
              <RowActions
                label={vehicle.placa}
                editTitle="Editar veículo"
                editForm={<VehicleForm vehicle={vehicle} units={units} />}
                isActive={vehicle.ativo}
                onToggleActive={setVehicleActive.bind(null, vehicle.id, !vehicle.ativo)}
                onDelete={deleteVehicle.bind(null, vehicle.id)}
                deleteWarning="Veículos com viagens registradas não podem ser excluídos — inative."
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
