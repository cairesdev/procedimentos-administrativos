import { IssueDocumentButton } from "@/features/documents/components/IssueDocumentButton";
import type { DocumentTemplate } from "@/features/documents/types";
import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteMaintenance } from "../actions";
import { CloseMaintenanceForm } from "./CloseMaintenanceForm";
import type { Maintenance } from "../types";

export const MaintenanceTable = ({
  maintenances,
  canWrite,
  canIssue,
  modelos,
}: {
  maintenances: Maintenance[];
  canWrite: boolean;
  canIssue: boolean;
  modelos: DocumentTemplate[];
}) => {
  const columns = ["Veículo", "Tipo", "Início", "Fim", "Oficina", "Custo", "Situação"];
  const temAcoes = canWrite || canIssue;

  return (
    <Table
      columns={temAcoes ? [...columns, ""] : columns}
      isEmpty={maintenances.length === 0}
      emptyMessage="Nenhuma manutenção registrada."
    >
      {maintenances.map((maintenance) => {
        const aberta = maintenance.dataFim === null;
        return (
          <tr key={maintenance.id}>
            <td>
              <strong>{maintenance.veiculoPlaca}</strong>
            </td>
            <td>{maintenance.tipo === "PREVENTIVA" ? "Preventiva" : "Corretiva"}</td>
            <td>{toDate(maintenance.dataInicio)}</td>
            <td>{maintenance.dataFim ? toDate(maintenance.dataFim) : "—"}</td>
            <td>{maintenance.oficina ?? "—"}</td>
            <td className={numericCell}>
              {maintenance.custo === null ? "—" : toCurrency(maintenance.custo)}
            </td>
            <td>
              <Badge tone={aberta ? "warning" : "success"}>
                {aberta ? "veículo parado" : "concluída"}
              </Badge>
            </td>
            {temAcoes ? (
              <td style={{ whiteSpace: "nowrap" }}>
                {canIssue ? (
                  <IssueDocumentButton
                    referenciaId={maintenance.id}
                    voltarPara="/frotas/manutencoes"
                    modelos={modelos.filter((modelo) => modelo.escopo === "MANUTENCAO")}
                    titulo={`Documento · ${maintenance.veiculoPlaca}`}
                    descricao={aberta ? "Manutenção em andamento" : "Manutenção encerrada"}
                    rotulo={`manutenção de ${maintenance.veiculoPlaca}`}
                  />
                ) : null}
                {canWrite ? (
                  <RowActions
                    label={`manutenção de ${maintenance.veiculoPlaca}`}
                    editTitle="Encerrar manutenção"
                    editForm={aberta ? <CloseMaintenanceForm maintenance={maintenance} /> : undefined}
                    onDelete={deleteMaintenance.bind(null, maintenance.id)}
                    deleteWarning="Apaga o registro do histórico do veículo. Se foi só engano de digitação, prefira encerrar."
                  />
                ) : null}
              </td>
            ) : null}
          </tr>
        );
      })}
    </Table>
  );
};
