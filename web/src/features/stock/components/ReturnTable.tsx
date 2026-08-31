"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { TextareaField } from "@/shared/ui/form-field";
import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { toDate, toDateTime } from "@/shared/ui/labels";
import { answerReturn } from "../actions";
import { RETURN_STATUSES, type StockReturn } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

const situacao = (status: string) =>
  RETURN_STATUSES.find((item) => item.value === status)
  ?? { label: status.toLowerCase(), tone: "neutral" as const };

export const ReturnTable = ({
  devolucoes,
  podeResponder,
  vazio = "Nenhuma devolução com esses filtros.",
}: {
  devolucoes: StockReturn[];
  podeResponder: boolean;
  /** O que dizer quando não há nada — a fila vazia é boa notícia, e o
   *  histórico vazio é outra coisa. */
  vazio?: string;
}) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<StockReturn | null>(null);
  const [motivo, setMotivo] = useState("");

  const responder = async (id: string, aceitar: boolean, motivoRecusa?: string) => {
    setOcupado(id);
    const resultado = await answerReturn(id, aceitar, motivoRecusa);
    setOcupado(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    setRecusando(null);
    setMotivo("");
    toast.success(resultado.success ?? "Pronto");
    router.refresh();
  };

  // A terceira coluna traz o local e quem pediu — a unidade de medida já sai
  // colada à quantidade. O rótulo "Unidade" dizia respeito à coluna errada.
  const colunas = ["Produto", "Quantidade", "Local", "Motivo", "Situação"];

  return (
    <>
      <Table
        columns={podeResponder ? [...colunas, ""] : colunas}
        isEmpty={devolucoes.length === 0}
        emptyMessage={vazio}
      >
        {devolucoes.map((devolucao) => {
          const estado = situacao(devolucao.status);

          return (
            <tr key={devolucao.id}>
              <td>
                {/* O nome leva ao detalhe, que é onde mora o comprovante. */}
                <Link href={`/almoxarifado/devolucoes/${devolucao.id}`}>
                  <strong>{devolucao.produtoNome}</strong>
                </Link>
                <br />
                <small>
                  {devolucao.dataValidade
                    ? `vence ${toDate(devolucao.dataValidade)}`
                    : "sem validade"}
                </small>
              </td>
              <td className={numericCell}>
                {formatar(devolucao.quantidade)} {devolucao.unidadeMedida}
              </td>
              <td>
                {devolucao.localNome}
                <br />
                <small>por {devolucao.solicitadaPor}</small>
              </td>
              <td>
                {devolucao.motivo ?? "—"}
                {devolucao.recusaMotivo ? (
                  <>
                    <br />
                    <small style={{ color: "var(--perigo)" }}>
                      Recusa: {devolucao.recusaMotivo}
                    </small>
                  </>
                ) : null}
              </td>
              <td>
                <Badge tone={estado.tone}>{estado.label}</Badge>
                <br />
                <small>
                  {devolucao.respondidaEm
                    ? `${toDateTime(devolucao.respondidaEm)} por ${devolucao.aceitaPor ?? "—"}`
                    : toDate(devolucao.data)}
                </small>
              </td>
              {podeResponder ? (
                <td style={{ whiteSpace: "nowrap" }}>
                  {devolucao.status === "PENDENTE" ? (
                    <span style={{ display: "inline-flex", gap: "6px" }}>
                      <Button
                        type="button"
                        disabled={ocupado === devolucao.id}
                        onClick={() => void responder(devolucao.id, true)}
                      >
                        Aceitar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={ocupado === devolucao.id}
                        onClick={() => setRecusando(devolucao)}
                      >
                        Recusar
                      </Button>
                    </span>
                  ) : (
                    <span style={{ color: "var(--texto_apagado)", fontSize: "13px" }}>—</span>
                  )}
                </td>
              ) : null}
            </tr>
          );
        })}
      </Table>

      <Modal
        open={recusando !== null}
        onClose={() => setRecusando(null)}
        title="Recusar devolução"
        description="O material volta para o armário da unidade, e ela vê o motivo."
      >
        <div style={{ display: "grid", gap: "14px" }}>
          <TextareaField
            label="Motivo"
            name="motivoRecusa"
            required
            rows={3}
            placeholder="Embalagem violada; produto fora da validade; quantidade não confere…"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              type="button"
              onClick={() => void responder(recusando!.id, false, motivo)}
              disabled={ocupado !== null || motivo.trim().length < 3}
            >
              Confirmar recusa
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
