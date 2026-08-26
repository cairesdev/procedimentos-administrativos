"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { deleteBatch } from "../actions";
import { EXPIRY_LABEL, EXPIRY_TONE, type Batch } from "../types";

const quantidade = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Situação da validade calculada na tela. É só alerta — nenhuma decisão do
 * sistema depende disto, e lote vencido continua saindo se o almoxarife quiser.
 */
const situacao = (dataValidade: string | null, alertaDias = 30) => {
  if (!dataValidade) return "SEM_VALIDADE" as const;
  const dias = Math.round(
    (Date.parse(`${dataValidade.slice(0, 10)}T12:00:00Z`) - Date.now()) / 86_400_000,
  );
  if (dias < 0) return "VENCIDO" as const;
  return dias <= alertaDias ? "PROXIMO" as const : "OK" as const;
};

export const BatchTable = ({
  batches,
  canWrite,
  alertaValidadeDias = 30,
}: {
  batches: Batch[];
  canWrite: boolean;
  alertaValidadeDias?: number;
}) => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  const excluir = async (batch: Batch) => {
    setOcupado(batch.id);
    const resultado = await deleteBatch(batch.id);
    setOcupado(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Lote excluído");
    router.refresh();
  };

  const colunas = ["Produto", "Quantidade", "Saldo", "Validade"];

  return (
    <Table
      columns={canWrite ? [...colunas, ""] : colunas}
      isEmpty={batches.length === 0}
      emptyMessage="Nenhum lote nesta remessa."
    >
      {batches.map((batch) => {
        const estado = situacao(batch.dataValidade, alertaValidadeDias);
        const consumido = batch.saldo < batch.quantidade;

        return (
          <tr key={batch.id}>
            <td>
              <strong>{batch.produtoNome}</strong>
              <br />
              <small>{batch.unidadeMedida}</small>
            </td>
            <td className={numericCell}>{quantidade(batch.quantidade)}</td>
            <td className={numericCell}>{quantidade(batch.saldo)}</td>
            <td>
              {batch.dataValidade ? toDate(batch.dataValidade) : "—"}{" "}
              <Badge tone={EXPIRY_TONE[estado]}>{EXPIRY_LABEL[estado]}</Badge>
            </td>
            {canWrite ? (
              <td style={{ textAlign: "right" }}>
                {/* Lote que já saiu não some: apagá-lo tiraria o rastro de
                    quem recebeu. A API recusa; aqui nem se oferece. */}
                {consumido ? (
                  <span style={{ color: "var(--texto_apagado)", fontSize: "12px" }}>
                    já movimentado
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={ocupado === batch.id}
                    onClick={() => void excluir(batch)}
                    title="Excluir lote"
                    aria-label={`Excluir lote de ${batch.produtoNome}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </Button>
                )}
              </td>
            ) : null}
          </tr>
        );
      })}
    </Table>
  );
};
