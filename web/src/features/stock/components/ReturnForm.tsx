"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { requestReturn } from "../actions";
import { opcoesDeLote } from "../returns";
import type { LocalStock } from "../types";

/**
 * Devolver material ao almoxarifado.
 *
 * A escolha é por **lote**, não por produto: é o lote que carrega a validade, e
 * é o saldo dele que volta. O almoxarifado precisa saber qual caixa está
 * recebendo de volta para saber quando ela vence.
 */
export const ReturnForm = ({ estoque }: { estoque: LocalStock[] }) => {
  const router = useRouter();
  const closeModal = useModalClose();

  const opcoes = opcoesDeLote(estoque);

  const [estoqueLocalId, setEstoqueLocalId] = useState(opcoes[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const escolhido = opcoes.find((item) => item.id === estoqueLocalId);
  const excede = escolhido ? quantidade > escolhido.saldo : false;

  const enviar = async () => {
    if (!escolhido) return;
    setEnviando(true);
    const resultado = await requestReturn({
      estoqueLocalId: escolhido.id, quantidade, motivo,
    });
    setEnviando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Devolução enviada para aceite");
    closeModal();
    router.refresh();
  };

  if (opcoes.length === 0) {
    return <Alert tone="info">Esta unidade não tem saldo para devolver.</Alert>;
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        O saldo sai do armário assim que você envia. Enquanto o almoxarifado não responde, esse
        material não pode ser consumido nem devolvido de novo — se for recusado, ele volta.
      </Alert>

      <SelectField
        label="Lote"
        name="estoqueLocalId"
        required
        value={estoqueLocalId}
        onChange={(evento) => setEstoqueLocalId(evento.target.value)}
        options={opcoes.map((item) => ({ value: item.id, label: item.rotulo }))}
      />

      <InputField
        label="Quantidade"
        name="quantidade"
        type="number"
        step="0.001"
        min="0"
        required
        value={quantidade || ""}
        onChange={(evento) => setQuantidade(Number(evento.target.value) || 0)}
        error={excede && escolhido
          ? `Este lote tem ${new Intl.NumberFormat("pt-BR", {
            maximumFractionDigits: 3,
          }).format(escolhido.saldo)}`
          : undefined}
      />

      <TextareaField
        label="Motivo"
        name="motivo"
        required
        rows={3}
        placeholder="Sobrou do período; produto não é usado nesta unidade; embalagem avariada…"
        value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="button"
          onClick={() => void enviar()}
          disabled={enviando || !escolhido || quantidade <= 0 || excede || motivo.trim().length < 3}
        >
          <Undo2 size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {enviando ? "Enviando…" : "Enviar devolução"}
        </Button>
      </div>
    </div>
  );
};
