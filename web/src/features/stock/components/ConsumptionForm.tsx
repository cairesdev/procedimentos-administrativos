"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { registerConsumption } from "../actions";
import { CONSUMPTION_FORMS, type LocalStock } from "../types";

const formatar = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Baixa por consumo.
 *
 * A unidade informa produto e quantidade; de quais lotes sai é conta do
 * sistema, em FEFO. Pedir para a cozinheira escolher a caixa transferiria a
 * ela um trabalho que o computador faz melhor — e ela escolheria a da frente,
 * que é justamente a errada.
 */
export const ConsumptionForm = ({
  localId,
  estoque,
}: {
  localId: string;
  estoque: LocalStock[];
}) => {
  const router = useRouter();
  const closeModal = useModalClose();

  const [produtoId, setProdutoId] = useState(estoque[0]?.produtoId ?? "");
  const [quantidade, setQuantidade] = useState(0);
  const [forma, setForma] = useState<string>("ITEM_A_ITEM");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const produto = estoque.find((item) => item.produtoId === produtoId);
  const periodico = forma === "DECLARACAO_PERIODICA";
  const excede = produto ? quantidade > produto.saldo : false;

  const registrar = async () => {
    setEnviando(true);
    const resultado = await registerConsumption({
      localId,
      produtoId,
      quantidade,
      forma,
      periodoInicio: periodico ? periodoInicio : undefined,
      periodoFim: periodico ? periodoFim : undefined,
      observacao: observacao || undefined,
    });
    setEnviando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Consumo registrado");
    closeModal();
    router.refresh();
  };

  if (estoque.length === 0) {
    return <Alert tone="info">Esta unidade não tem saldo para consumir.</Alert>;
  }

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <SelectField
        label="Produto"
        name="produtoId"
        required
        value={produtoId}
        onChange={(evento) => setProdutoId(evento.target.value)}
        options={estoque.map((item) => ({
          value: item.produtoId,
          label: `${item.produtoNome} · ${formatar(item.saldo)} ${item.unidadeMedida}`,
        }))}
      />

      {produto ? (
        <Alert tone="info">
          Sai primeiro o lote que vence antes:{" "}
          {produto.lotes[0]?.dataValidade
            ? `${formatar(produto.lotes[0].saldo)} ${produto.unidadeMedida} vencendo em ${toDate(produto.lotes[0].dataValidade)}`
            : "os lotes deste produto não têm validade"}
          . {produto.lotes.length > 1 ? `Há ${produto.lotes.length} lotes no armário.` : null}
        </Alert>
      ) : null}

      <InputField
        label={`Quantidade${produto ? ` (${produto.unidadeMedida})` : ""}`}
        name="quantidade"
        type="number"
        step="0.001"
        min="0"
        required
        value={quantidade || ""}
        onChange={(evento) => setQuantidade(Number(evento.target.value) || 0)}
        error={excede ? `A unidade tem ${formatar(produto!.saldo)}` : undefined}
      />

      <SelectField
        label="Forma"
        name="forma"
        value={forma}
        onChange={(evento) => setForma(evento.target.value)}
        options={CONSUMPTION_FORMS.map((item) => ({ value: item.value, label: item.label }))}
        hint="Declaração é o fechamento do período; item a item é a retirada do dia."
      />

      {periodico ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <InputField
            label="Início do período"
            name="periodoInicio"
            type="date"
            required
            value={periodoInicio}
            onChange={(evento) => setPeriodoInicio(evento.target.value)}
          />
          <InputField
            label="Fim do período"
            name="periodoFim"
            type="date"
            required
            value={periodoFim}
            onChange={(evento) => setPeriodoFim(evento.target.value)}
          />
        </div>
      ) : null}

      <TextareaField
        label="Observação"
        name="observacao"
        rows={2}
        placeholder="Merenda da semana, evento na escola…"
        value={observacao}
        onChange={(evento) => setObservacao(evento.target.value)}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="button"
          onClick={() => void registrar()}
          disabled={
            enviando
            || quantidade <= 0
            || excede
            || (periodico && (!periodoInicio || !periodoFim))
          }
        >
          <Minus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          {enviando ? "Registrando…" : "Registrar consumo"}
        </Button>
      </div>
    </div>
  );
};
