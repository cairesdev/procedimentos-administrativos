"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Alert, Badge, Table } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import { issueDocument } from "../actions";
import type { DocumentTemplate, IssuedDocument } from "../types";

/**
 * Emitir peça é ação explícita: o sistema não decide por conta própria qual
 * documento o processo precisa. A lista abaixo mostra o que já saiu, para
 * ninguém emitir a mesma coisa duas vezes sem perceber.
 */
export const IssueDocumentPanel = ({
  referenciaId,
  voltarPara,
  modelos,
  emitidos,
  podeEmitir,
}: {
  referenciaId: string;
  voltarPara: string;
  modelos: DocumentTemplate[];
  emitidos: IssuedDocument[];
  podeEmitir: boolean;
}) => {
  const disponiveis = modelos.filter((modelo) => modelo.ativo);
  const [tipo, setTipo] = useState<string>(disponiveis[0]?.tipo ?? "");
  const [emitindo, iniciarEmissao] = useTransition();

  const emitir = () => {
    if (!tipo) return;
    iniciarEmissao(async () => {
      // Sucesso redireciona para a peça, então só erro volta com resultado.
      const resultado = await issueDocument({ tipo, referenciaId, voltarPara });
      if (resultado?.error) toast.error(resultado.error);
    });
  };

  return (
    <>
      {podeEmitir ? (
        disponiveis.length === 0 ? (
          <Alert tone="info">
            Nenhum modelo de documento disponível para este módulo. O administrador da prefeitura
            configura os modelos em Administração › Documentos.
          </Alert>
        ) : (
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
            <select
              value={tipo}
              onChange={(evento) => setTipo(evento.target.value)}
              aria-label="Tipo de documento"
              style={{ flex: 1 }}
            >
              {disponiveis.map((modelo) => (
                <option key={modelo.tipo} value={modelo.tipo}>
                  {modelo.nome}
                </option>
              ))}
            </select>
            <Button type="button" onClick={emitir} disabled={emitindo}>
              <FileText size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {emitindo ? "Emitindo…" : "Emitir"}
            </Button>
          </div>
        )
      ) : null}

      <Table
        columns={["Documento", "Código", "Emitido por", "Quando", ""]}
        isEmpty={emitidos.length === 0}
        emptyMessage="Nenhum documento emitido para este registro."
      >
        {emitidos.map((documento) => (
          <tr key={documento.id}>
            <td>
              {documento.titulo}
              {documento.canceladoEm ? (
                <>
                  {" "}
                  <Badge tone="warning">cancelado</Badge>
                </>
              ) : null}
            </td>
            <td style={{ fontFamily: "ui-monospace, monospace" }}>{documento.codigo}</td>
            <td>
              {documento.emitidoPorNome}
              <br />
              <small>{documento.emitidoPorCargo}</small>
            </td>
            <td>{toDateTime(documento.data)}</td>
            <td style={{ textAlign: "right" }}>
              <Link href={`/processos/documentos/${documento.id}`} style={{ color: "var(--acao)" }}>
                <Printer size={14} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "4px" }} />
                Abrir
              </Link>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
};
