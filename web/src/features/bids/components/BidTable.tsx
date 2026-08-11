import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { humanize, toCurrency, toDate } from "@/shared/ui/labels";
import type { Bid } from "../types";

export const BidTable = ({ bids }: { bids: Bid[] }) => (
  <Table
    columns={["Número", "Objeto", "Modalidade", "Assinatura", "Valor"]}
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
      </tr>
    ))}
  </Table>
);
