"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IssueDocumentButton } from "@/features/documents/components/IssueDocumentButton";
import type { DocumentTemplate } from "@/features/documents/types";
import { Button } from "@/shared/ui/button";
import { Badge, Table } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import { acceptTransfer, refuseTransfer } from "../actions";
import type { AssetTransfer, TransferStatus } from "../types";

const SITUACAO: Record<TransferStatus, { label: string; tone: "accent" | "success" | "neutral" }> = {
  PENDENTE: { label: "aguardando aceite", tone: "accent" },
  ACEITA: { label: "aceita", tone: "success" },
  RECUSADA: { label: "recusada", tone: "neutral" },
};

export const TransferTable = ({
  transfers,
  canWrite,
  canIssue,
  modelos,
}: {
  transfers: AssetTransfer[];
  canWrite: boolean;
  canIssue: boolean;
  modelos: DocumentTemplate[];
}) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  const responder = async (
    id: string,
    operacao: typeof acceptTransfer,
  ) => {
    setOcupado(id);
    const resultado = await operacao(id);
    setOcupado(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Pronto");
    router.refresh();
  };

  const colunas = ["Bem", "De", "Para", "Enviada", "Situação"];
  const temAcoes = canWrite || canIssue;

  return (
    <Table
      columns={temAcoes ? [...colunas, ""] : colunas}
      isEmpty={transfers.length === 0}
      emptyMessage="Nenhuma transferência com esses filtros."
    >
      {transfers.map((transfer) => (
        <tr key={transfer.id}>
          <td>
            <strong>{transfer.codigoTombamento}</strong>
            <br />
            <small>{transfer.nomeBem}</small>
          </td>
          <td>{transfer.localOrigemNome}</td>
          <td>{transfer.localDestinoNome}</td>
          <td>
            {toDateTime(transfer.dataEnvio)}
            <br />
            <small>por {transfer.enviadoPor}</small>
          </td>
          <td>
            <Badge tone={SITUACAO[transfer.status].tone}>
              {SITUACAO[transfer.status].label}
            </Badge>
            {transfer.dataAceite ? (
              <>
                <br />
                <small>
                  {toDateTime(transfer.dataAceite)} por {transfer.aceitoPor}
                </small>
              </>
            ) : null}
          </td>
          {temAcoes ? (
            <td style={{ whiteSpace: "nowrap" }}>
              {canWrite && transfer.status === "PENDENTE" ? (
                <span style={{ display: "inline-flex", gap: "6px" }}>
                  <Button
                    type="button"
                    disabled={ocupado === transfer.id}
                    onClick={() => responder(transfer.id, acceptTransfer)}
                  >
                    Aceitar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={ocupado === transfer.id}
                    onClick={() => responder(transfer.id, refuseTransfer)}
                  >
                    Recusar
                  </Button>
                </span>
              ) : null}

              {/* Recusada não rende termo: não houve transferência a documentar. */}
              {canIssue && transfer.status !== "RECUSADA" ? (
                <IssueDocumentButton
                  referenciaId={transfer.id}
                  voltarPara="/patrimonio/transferencias"
                  modelos={modelos.filter((modelo) => modelo.escopo === "TRANSFERENCIA_BEM")}
                  titulo={`Documento · ${transfer.codigoTombamento}`}
                  descricao={`${transfer.localOrigemNome} → ${transfer.localDestinoNome}`}
                  rotulo={`transferência de ${transfer.codigoTombamento}`}
                />
              ) : null}
            </td>
          ) : null}
        </tr>
      ))}
    </Table>
  );
};
