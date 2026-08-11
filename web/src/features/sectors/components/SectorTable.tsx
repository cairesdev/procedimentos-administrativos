import Link from "next/link";
import { Badge, Table } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteSector, setSectorActive } from "../actions";
import { SectorForm } from "./SectorForm";
import type { Sector } from "../types";

export const SectorTable = ({ sectors, canWrite }: { sectors: Sector[]; canWrite: boolean }) => (
  <Table
    columns={canWrite ? ["Nome", "Tipo", "Situação", ""] : ["Nome", "Tipo", "Situação"]}
    isEmpty={sectors.length === 0}
    emptyMessage="Nenhum setor cadastrado."
  >
    {sectors.map((sector) => (
      <tr key={sector.id}>
        <td>
          <Link href={`/setores/${sector.id}`} style={{ color: "var(--acao)" }}>
            {sector.nome}
          </Link>
        </td>
        <td>
          <Badge tone="accent">{humanize(sector.tipo)}</Badge>
        </td>
        <td>
          <Badge tone={sector.ativo ? "success" : "neutral"}>
            {sector.ativo ? "ativo" : "inativo"}
          </Badge>
        </td>
        {canWrite ? (
          <td>
            <RowActions
              label={sector.nome}
              editTitle="Editar setor"
              editForm={<SectorForm sector={sector} />}
              isActive={sector.ativo}
              onToggleActive={setSectorActive.bind(null, sector.id, !sector.ativo)}
              onDelete={deleteSector.bind(null, sector.id)}
              deleteWarning="Setores com processos, despachos, lotações ou etapas de fluxo não podem ser excluídos — inative."
            />
          </td>
        ) : null}
      </tr>
    ))}
  </Table>
);
