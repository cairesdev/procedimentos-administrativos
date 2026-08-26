"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { adjustStock } from "../actions";
import { ADJUSTMENT_REASONS, type LocalStock } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Contagem física que não bate com o sistema.
 *
 * O campo é o saldo **contado**, não a diferença: quem está com o produto na
 * mão sabe quanto tem, não quanto sumiu. O sistema calcula a diferença e a
 * registra na auditoria.
 *
 * É a válvula que impede o resto do módulo de precisar mentir — sem ajuste,
 * quem perdeu um saco de arroz lançaria um consumo falso, e o relatório do
 * PNAE viraria ficção.
 */
export const AdjustmentForm = ({ estoque }: { estoque: LocalStock[] }) => {
  const router = useRouter();
  const closeModal = useModalClose();

  const opcoes = estoque.flatMap((produto) =>
    produto.lotes.map((lote) => ({
      id: lote.id,
      rotulo: `${produto.produtoNome} · ${formatar(lote.saldo)} ${produto.unidadeMedida}`
        + (lote.dataValidade ? ` · vence ${toDate(lote.dataValidade)}` : ""),
      saldo: lote.saldo,
      unidade: produto.unidadeMedida,
    })),
  );

  const [estoqueLocalId, setEstoqueLocalId] = useState(opcoes[0]?.id ?? "");
  const [saldoCorrigido, setSaldoCorrigido] = useState<number | "">("");
  const [motivo, setMotivo] = useState<string>("CONTAGEM");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const escolhido = opcoes.find((item) => item.id === estoqueLocalId);
  const diferenca =
    escolhido && saldoCorrigido !== ""
      ? Math.round((Number(saldoCorrigido) - escolhido.saldo) * 1000) / 1000
      : 0;

  const enviar = async () => {
    setEnviando(true);
    const resultado = await adjustStock({
      estoqueLocalId,
      saldoCorrigido: Number(saldoCorrigido),
      motivo,
      observacao: observacao || undefined,
    });
    setEnviando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Ajuste registrado");
    closeModal();
    router.refresh();
  };

  if (opcoes.length === 0) {
    return <Alert tone="info">Esta unidade não tem lote para ajustar.</Alert>;
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <SelectField
        label="Lote"
        name="estoqueLocalId"
        required
        value={estoqueLocalId}
        onChange={(evento) => {
          setEstoqueLocalId(evento.target.value);
          setSaldoCorrigido("");
        }}
        options={opcoes.map((item) => ({ value: item.id, label: item.rotulo }))}
      />

      <InputField
        label={`Saldo contado${escolhido ? ` (${escolhido.unidade})` : ""}`}
        name="saldoCorrigido"
        type="number"
        step="0.001"
        min="0"
        required
        value={saldoCorrigido}
        onChange={(evento) =>
          setSaldoCorrigido(evento.target.value === "" ? "" : Number(evento.target.value))
        }
        hint="Quanto existe de fato. O sistema calcula a diferença."
      />

      {escolhido && saldoCorrigido !== "" && diferenca !== 0 ? (
        <Alert tone={diferenca < 0 ? "error" : "info"}>
          O sistema tem {formatar(escolhido.saldo)} e você contou {formatar(Number(saldoCorrigido))}
          {" "}— diferença de {formatar(Math.abs(diferenca))} {escolhido.unidade}{" "}
          {diferenca < 0 ? "a menos" : "a mais"}.
        </Alert>
      ) : null}

      <SelectField
        label="Motivo"
        name="motivo"
        required
        value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
        options={ADJUSTMENT_REASONS.map((item) => ({ value: item.value, label: item.label }))}
      />

      <TextareaField
        label="Observação"
        name="observacao"
        rows={2}
        placeholder="Contagem do fim do mês; caixa encontrada no depósito…"
        value={observacao}
        onChange={(evento) => setObservacao(evento.target.value)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando || saldoCorrigido === "" || diferenca === 0}
        >
          <Scale size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {enviando ? "Registrando…" : "Registrar ajuste"}
        </Button>
      </div>
    </div>
  );
};
