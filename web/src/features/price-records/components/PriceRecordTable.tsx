import Link from "next/link";
import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import { deletePriceRecord } from "../actions";
import type { PriceRecord } from "../types";

export const PriceRecordTable = ({
  records,
  canWrite,
}: {
  records: PriceRecord[];
  canWrite: boolean;
}) => (
  <Table
    columns={
      canWrite
        ? ["Número", "Objeto", "Vigência", "Valor", "Situação", ""]
        : ["Número", "Objeto", "Vigência", "Valor", "Situação"]
    }
    isEmpty={records.length === 0}
    emptyMessage="Nenhuma ata cadastrada."
  >
    {records.map((record) => {
      const expired = new Date(record.dataVigencia) < new Date();
      return (
        <tr key={record.id}>
          <td>
            <Link href={`/processos/atas/${record.id}`} style={{ color: "var(--acao)" }}>
              {record.numero}
            </Link>
          </td>
          <td title={record.objeto}>{record.objeto.slice(0, 60)}</td>
          <td>{toDate(record.dataVigencia)}</td>
          <td className={numericCell}>{toCurrency(record.valorTotal)}</td>
          <td>
            <Badge tone={expired ? "warning" : "success"}>{expired ? "vencida" : "vigente"}</Badge>
          </td>
          {canWrite ? (
            <td>
              <RowActions
                label={`ata ${record.numero}`}
                onDelete={deletePriceRecord.bind(null, record.id)}
                deleteWarning="Ata já usada em contrato não pode ser excluída."
              />
            </td>
          ) : null}
        </tr>
      );
    })}
  </Table>
);
