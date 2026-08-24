import Link from "next/link";
import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { toCurrency, toDateTime } from "@/shared/ui/labels";
import type { RequestSummary } from "../types";

export const RequestTable = ({ requests }: { requests: RequestSummary[] }) => (
  <Table
    columns={["Protocolo", "Unidade", "Criada em", "Itens", "Valor", "Situação"]}
    isEmpty={requests.length === 0}
    emptyMessage="Nenhuma solicitação com esses filtros."
  >
    {requests.map((request) => (
      <tr key={request.id}>
        <td>
          <Link href={`/processos/solicitacoes/${request.id}`} style={{ color: "var(--acao)" }}>
            {/* Rascunho ainda não tem número: o id é o que existe para abrir. */}
            {request.numeroProtocolo ?? "sem número"}
          </Link>
          {request.numeroProcessoAdm ? (
            <>
              <br />
              <small>proc. {request.numeroProcessoAdm}</small>
            </>
          ) : null}
        </td>
        <td>{request.unidadeSolicitanteNome}</td>
        <td>{toDateTime(request.criadaEm)}</td>
        <td className={numericCell}>{request.totalItens}</td>
        <td className={numericCell}>{toCurrency(request.valorTotal)}</td>
        <td>
          <Badge tone={request.situacao === "RASCUNHO" ? "warning" : "success"}>
            {request.situacao === "RASCUNHO" ? "rascunho" : "enviada"}
          </Badge>
        </td>
      </tr>
    ))}
  </Table>
);
