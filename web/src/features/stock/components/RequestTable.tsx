import Link from "next/link";
import { Badge, Table } from "@/shared/ui/layout";
import { toDate, toDateTime } from "@/shared/ui/labels";
import { statusOf, type StockRequestSummary } from "../types";

export const RequestTable = ({ requests }: { requests: StockRequestSummary[] }) => (
  <Table
    columns={["Local", "Situação", "Itens", "Aberto em", "Enviado em"]}
    isEmpty={requests.length === 0}
    emptyMessage="Nenhum pedido com esses filtros."
  >
    {requests.map((request) => {
      const situacao = statusOf(request.status);

      return (
        <tr key={request.id}>
          <td>
            <Link
              href={`/almoxarifado/solicitacoes/${request.id}`}
              style={{ color: "var(--acao)" }}
            >
              <strong>{request.localSolicitanteNome}</strong>
            </Link>
            <br />
            <small>por {request.autorNome}</small>
          </td>
          <td>
            <Badge tone={situacao.tone}>{situacao.label}</Badge>
            {request.tipoEstoqueNome ? (
              <>
                <br />
                <small>{request.tipoEstoqueNome}</small>
              </>
            ) : null}
          </td>
          <td>{request.totalItens}</td>
          <td>{toDate(request.data)}</td>
          <td>{request.enviadaEm ? toDateTime(request.enviadaEm) : "—"}</td>
        </tr>
      );
    })}
  </Table>
);
