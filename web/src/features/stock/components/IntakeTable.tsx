import Link from "next/link";
import { Table } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import type { Intake } from "../types";

export const IntakeTable = ({ intakes }: { intakes: Intake[] }) => (
  <Table
    columns={["Código", "Remessa", "Almoxarifado", "Tipo", "Lotes", "Entrada"]}
    isEmpty={intakes.length === 0}
    emptyMessage="Nenhuma entrada com esses filtros."
  >
    {intakes.map((intake) => (
      <tr key={intake.id}>
        <td>
          <Link href={`/almoxarifado/entradas/${intake.id}`} style={{ color: "var(--acao)" }}>
            <strong>{intake.codigo}</strong>
          </Link>
        </td>
        <td>
          {intake.titulo}
          {intake.notaFiscal ? (
            <>
              <br />
              <small>NF {intake.notaFiscal}</small>
            </>
          ) : null}
        </td>
        <td>{intake.almoxarifadoNome}</td>
        <td>{intake.tipoEstoqueNome}</td>
        <td>{intake.lotes}</td>
        <td>
          {toDate(intake.data)}
          <br />
          <small>por {intake.responsavelNome}</small>
        </td>
      </tr>
    ))}
  </Table>
);
