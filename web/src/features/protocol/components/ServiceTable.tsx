import Link from "next/link";
import { Badge, Table } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import type { ServiceRecord } from "../types";

const tone = {
  ABERTO: "accent",
  TRAMITANDO: "accent",
  ENCERRADO: "success",
  CANCELADO: "neutral",
} as const;

/** Formata CPF/CNPJ para leitura; documento cru é difícil de conferir a olho. */
const documento = (bruto: string) => {
  if (bruto.length === 11) return bruto.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (bruto.length === 14) {
    return bruto.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return bruto;
};

export const ServiceTable = ({ records }: { records: ServiceRecord[] }) => (
  <Table
    columns={["Protocolo", "Requerente", "Assunto", "Setor atual", "Origem", "Situação"]}
    isEmpty={records.length === 0}
    emptyMessage="Nenhum atendimento externo registrado."
  >
    {records.map((record) => (
      <tr key={record.id}>
        <td>
          <Link href={`/processos/fila/${record.id}`} style={{ color: "var(--acao)" }}>
            {record.numeroProtocolo}
          </Link>
          <br />
          <small>{toDateTime(record.dataAbertura)}</small>
        </td>
        <td>
          {record.requerenteNome}
          <br />
          <small>{documento(record.requerenteDocumento)}</small>
        </td>
        <td>{record.assuntoNome ?? "—"}</td>
        <td>{record.setorAtualNome ?? "—"}</td>
        <td>
          <Badge tone="neutral">
            {record.origemAtendimento === "PORTAL" ? "portal" : "balcão"}
          </Badge>
        </td>
        <td>
          <Badge tone={tone[record.status as keyof typeof tone] ?? "neutral"}>
            {record.status.toLowerCase()}
          </Badge>
        </td>
      </tr>
    ))}
  </Table>
);
