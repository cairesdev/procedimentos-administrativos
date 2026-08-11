import { Badge, Table } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import type { Sector } from "../types";

export const SectorTable = ({ sectors }: { sectors: Sector[] }) => (
  <Table
    columns={["Nome", "Tipo", "Situação"]}
    isEmpty={sectors.length === 0}
    emptyMessage="Nenhum setor cadastrado."
  >
    {sectors.map((sector) => (
      <tr key={sector.id}>
        <td>{sector.nome}</td>
        <td>
          <Badge tone="accent">{humanize(sector.tipo)}</Badge>
        </td>
        <td>
          <Badge tone={sector.ativo ? "success" : "neutral"}>
            {sector.ativo ? "ativo" : "inativo"}
          </Badge>
        </td>
      </tr>
    ))}
  </Table>
);
