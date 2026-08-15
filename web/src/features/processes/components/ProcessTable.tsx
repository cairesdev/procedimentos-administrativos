import Link from "next/link";
import { Badge, Table } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import type { Sector } from "@/features/sectors/types";
import type { Process } from "../types";

const statusTone = {
  ABERTO: "accent",
  TRAMITANDO: "accent",
  ENCERRADO: "success",
  CANCELADO: "neutral",
} as const;

export const ProcessTable = ({
  processes,
  sectors,
}: {
  processes: Process[];
  sectors: Sector[];
}) => (
  <Table
    columns={["Protocolo", "Processo", "Tipo", "Setor atual", "Situação"]}
    isEmpty={processes.length === 0}
    emptyMessage="Nenhum processo na fila."
  >
    {processes.map((process) => (
      <tr key={process.id}>
        <td>
          <Link href={`/processos/fila/${process.id}`} style={{ color: "var(--acao)" }}>
            {process.numeroProtocolo}
          </Link>
        </td>
        <td>{process.numeroProcessoAdm}</td>
        <td>{humanize(process.tipoProcesso)}</td>
        <td>
          {sectors.find((sector) => sector.id === process.setorAtualId)?.nome ?? "—"}
        </td>
        <td>
          <Badge tone={statusTone[process.status]}>{process.status.toLowerCase()}</Badge>
        </td>
      </tr>
    ))}
  </Table>
);
