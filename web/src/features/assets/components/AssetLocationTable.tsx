import type { Option } from "@/shared/ui/form-field";
import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteAssetLocation, setAssetLocationActive } from "../actions";
import { AssetLocationForm } from "./AssetLocationForm";
import type { AssetLocation } from "../types";

export const AssetLocationTable = ({
  locations,
  units,
  canWrite,
}: {
  locations: AssetLocation[];
  units: Option[];
  canWrite: boolean;
}) => {
  const columns = ["Código", "Local", "Unidade", "Bens", "Situação"];

  return (
    <Table
      columns={canWrite ? [...columns, ""] : columns}
      isEmpty={locations.length === 0}
      emptyMessage="Nenhum local cadastrado. O código do local é o prefixo do tombamento."
    >
      {locations.map((location) => (
        <tr key={location.id}>
          <td>
            <strong>{location.codigo}</strong>
          </td>
          <td>{location.nome}</td>
          <td>{units.find((unit) => unit.value === location.unidadeId)?.label ?? "—"}</td>
          <td className={numericCell}>{location.bens}</td>
          <td>
            <Badge tone={location.ativo ? "success" : "neutral"}>
              {location.ativo ? "ativo" : "inativo"}
            </Badge>
          </td>
          {canWrite ? (
            <td>
              <RowActions
                label={location.nome}
                editTitle="Editar local"
                editForm={<AssetLocationForm location={location} units={units} />}
                isActive={location.ativo}
                onToggleActive={setAssetLocationActive.bind(null, location.id, !location.ativo)}
                onDelete={deleteAssetLocation.bind(null, location.id)}
                deleteWarning="Locais com bens tombados ou inventários não podem ser excluídos — inative."
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
