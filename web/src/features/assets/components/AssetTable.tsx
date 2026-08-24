import { Badge, Table } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteAsset } from "../actions";
import { AssetMovementActions } from "./AssetMovementActions";
import { AssetForm } from "./AssetForm";
import { CONSERVATION_STATES, type Asset, type AssetCategory, type AssetLocation } from "../types";

const stateTone = (state: string) =>
  state === "DANIFICADO" || state === "EM_CONSERTO" ? "warning" : "success";

export const AssetTable = ({
  assets,
  categories,
  locations,
  canWrite,
}: {
  assets: Asset[];
  categories: AssetCategory[];
  locations: AssetLocation[];
  canWrite: boolean;
}) => {
  const columns = ["Tombamento", "Bem", "Categoria", "Local", "Conservação", "Situação"];

  return (
    <Table
      columns={canWrite ? [...columns, ""] : columns}
      isEmpty={assets.length === 0}
      emptyMessage="Nenhum bem tombado com esses filtros."
    >
      {assets.map((asset) => (
        <tr key={asset.id}>
          <td>
            <strong>{asset.codigoTombamento}</strong>
          </td>
          <td>{asset.nome}</td>
          <td>{asset.categoriaNome}</td>
          <td>{asset.localAtualNome}</td>
          <td>
            <Badge tone={stateTone(asset.estadoConservacao)}>
              {CONSERVATION_STATES.find((state) => state.value === asset.estadoConservacao)?.label ??
                humanize(asset.estadoConservacao)}
            </Badge>
          </td>
          <td>
            <Badge tone={asset.status === "ATIVO" ? "accent" : "neutral"}>
              {humanize(asset.status)}
            </Badge>
          </td>
          {canWrite ? (
            <td style={{ whiteSpace: "nowrap" }}>
              <AssetMovementActions asset={asset} locations={locations} />
              <RowActions
                label={asset.codigoTombamento}
                editTitle="Editar bem"
                editForm={<AssetForm asset={asset} categories={categories} />}
                onDelete={deleteAsset.bind(null, asset.id)}
                deleteWarning="O tombamento não volta a ser usado. Bloqueado se o bem já foi conferido em algum inventário."
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
