import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { humanize, toCurrency, toDate } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import type { Unit } from "@/features/units/types";
import { deleteBid } from "../actions";
import { BidForm } from "./BidForm";
import type { Bid } from "../types";

export const BidTable = ({
  bids,
  canWrite,
  units,
}: {
  bids: Bid[];
  canWrite: boolean;
  units: Unit[];
}) => (
  <Table
    columns={
      canWrite
        ? ["Número", "Objeto", "Modalidade", "Assinatura", "Valor", ""]
        : ["Número", "Objeto", "Modalidade", "Assinatura", "Valor"]
    }
    isEmpty={bids.length === 0}
    emptyMessage="Nenhuma licitação cadastrada."
  >
    {bids.map((bid) => (
      <tr key={bid.id}>
        <td>{bid.numero}</td>
        <td title={bid.objeto}>{bid.objeto.slice(0, 60)}</td>
        <td>
          <Badge tone="accent">{humanize(bid.modalidade)}</Badge>
        </td>
        <td>{toDate(bid.dataAssinatura)}</td>
        <td className={numericCell}>{toCurrency(bid.valorTotal)}</td>
        {canWrite ? (
          <td>
            <RowActions
              label={`licitação ${bid.numero}`}
              editTitle="Editar licitação"
              editDescription="Se já originou contrato ou ata, apenas resumo e objeto são aceitos."
              editForm={<BidForm bid={bid} units={units} />}
              onDelete={deleteBid.bind(null, bid.id)}
              deleteWarning="Licitação que já gerou contrato ou ata não pode ser excluída."
            />
          </td>
        ) : null}
      </tr>
    ))}
  </Table>
);
