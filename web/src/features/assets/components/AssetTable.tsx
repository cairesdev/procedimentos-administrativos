import { IssueDocumentButton } from "@/features/documents/components/IssueDocumentButton";
import type { DocumentTemplate } from "@/features/documents/types";
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
  canIssue,
  modelos,
}: {
  assets: Asset[];
  categories: AssetCategory[];
  locations: AssetLocation[];
  canWrite: boolean;
  canIssue: boolean;
  modelos: DocumentTemplate[];
}) => {
  const columns = ["Tombamento", "Bem", "Categoria", "Local", "Conservação", "Situação"];
  // Quem só emite documento também precisa da coluna de ações: antes ela
  // dependia de `canWrite` e o botão de imprimir não teria onde aparecer.
  const temAcoes = canWrite || canIssue;

  return (
    <Table
      columns={temAcoes ? [...columns, ""] : columns}
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
          {temAcoes ? (
            <td style={{ whiteSpace: "nowrap" }}>
              {canIssue ? (
                <IssueDocumentButton
                  referenciaId={asset.id}
                  voltarPara="/patrimonio/bens"
                  // Bem ativo rende termo de responsabilidade; bem baixado, o
                  // termo de baixa. Oferecer os dois sempre produziria peça
                  // que a emissão recusa — a baixa nem existe no registro.
                  modelos={modelos.filter((modelo) =>
                    modelo.escopo === (asset.status === "ATIVO" ? "BEM" : "BAIXA_BEM"))}
                  titulo={`Documento · ${asset.codigoTombamento}`}
                  descricao={asset.nome}
                  rotulo={asset.codigoTombamento}
                />
              ) : null}
              {canWrite ? (
                <>
                  <AssetMovementActions asset={asset} locations={locations} />
                  <RowActions
                    label={asset.codigoTombamento}
                    editTitle="Editar bem"
                    editForm={<AssetForm asset={asset} categories={categories} />}
                    onDelete={deleteAsset.bind(null, asset.id)}
                    deleteWarning="O tombamento não volta a ser usado. Bloqueado se o bem já foi conferido em algum inventário."
                  />
                </>
              ) : null}
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
