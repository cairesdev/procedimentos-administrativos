import Link from "next/link";
import { Badge, Table } from "@/shared/ui/layout";
import { humanize, toDate } from "@/shared/ui/labels";
import type { Sector } from "@/features/sectors/types";
import { deadlineOf } from "../deadline";
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
  limiarAlertaDias,
}: {
  processes: Process[];
  sectors: Sector[];
  limiarAlertaDias: number;
}) => (
  <Table
    columns={["Protocolo", "Processo", "Tipo", "Setor atual", "Prazo", "Situação"]}
    isEmpty={processes.length === 0}
    emptyMessage="Nenhum processo na fila."
  >
    {processes.map((process) => {
      const prazo = deadlineOf(process, limiarAlertaDias);

      return (
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
            <br />
            <small>desde {toDate(process.entrouNoSetorEm)}</small>
          </td>
          <td>
            {prazo.state === "sem-prazo" ? (
              <span style={{ color: "var(--texto_apagado)" }}>—</span>
            ) : (
              <>
                <Badge tone={prazo.tone}>{prazo.label}</Badge>
                {process.prazoLimite ? (
                  <>
                    <br />
                    <small>até {toDate(process.prazoLimite)}</small>
                  </>
                ) : null}
              </>
            )}
          </td>
          <td>
            <Badge tone={statusTone[process.status]}>{process.status.toLowerCase()}</Badge>
          </td>
        </tr>
      );
    })}
  </Table>
);
