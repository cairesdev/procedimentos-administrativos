import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteAssetCategory, setAssetCategoryActive } from "../actions";
import { AssetCategoryForm } from "./AssetCategoryForm";
import type { AssetCategory } from "../types";

export const AssetCategoryTable = ({
  categories,
  canWrite,
}: {
  categories: AssetCategory[];
  canWrite: boolean;
}) => {
  const columns = ["Categoria", "Bens", "Situação"];

  return (
    <Table
      columns={canWrite ? [...columns, ""] : columns}
      isEmpty={categories.length === 0}
      emptyMessage="Nenhuma categoria cadastrada."
    >
      {categories.map((category) => (
        <tr key={category.id}>
          <td>{category.nome}</td>
          <td className={numericCell}>{category.bens}</td>
          <td>
            <Badge tone={category.ativo ? "success" : "neutral"}>
              {category.ativo ? "ativa" : "inativa"}
            </Badge>
          </td>
          {canWrite ? (
            <td>
              <RowActions
                label={category.nome}
                editTitle="Editar categoria"
                editForm={<AssetCategoryForm category={category} />}
                isActive={category.ativo}
                onToggleActive={setAssetCategoryActive.bind(null, category.id, !category.ativo)}
                onDelete={deleteAssetCategory.bind(null, category.id)}
                deleteWarning="Categorias com bens tombados não podem ser excluídas — inative."
              />
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
