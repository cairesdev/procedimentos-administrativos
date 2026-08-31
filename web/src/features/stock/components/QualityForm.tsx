"use client";

import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { registerQuality } from "../actions";
import { qualitySchema, type QualityInput } from "../schemas";
import { QUALITY_TYPES, type LocalStock } from "../types";

/**
 * Anotar o que se observou no material armazenado.
 *
 * **Não mexe em saldo.** Quem tira material do estoque é o ajuste, que exige
 * motivo — e é por não movimentar nada que este registro pode ser livre. Fosse
 * o contrário, quem só quis anotar uma caixa amassada hesitaria em anotar.
 */
export const QualityForm = ({
  estoqueDaUnidade,
}: {
  /** Lotes já entregues à unidade — é sobre eles que a escola observa. */
  estoqueDaUnidade: LocalStock[];
}) => {
  const closeModal = useModalClose();

  const opcoesDaUnidade = estoqueDaUnidade.flatMap((produto) =>
    produto.lotes.map((lote) => ({
      value: lote.id,
      label: `${produto.produtoNome} · ${lote.saldo} ${produto.unidadeMedida}`
        + (lote.dataValidade ? ` · vence ${lote.dataValidade}` : ""),
    })));

  const { form, onSubmit, isSubmitting } = useResourceForm<QualityInput>({
    schema: qualitySchema as never,
    defaultValues: {
      estoqueLocalId: opcoesDaUnidade[0]?.value ?? "",
      tipo: "DANO",
      observacao: "",
    },
    action: (values) => registerQuality({
      ...values,
      // Um lado ou o outro: o material está num lugar só, e a API recusa os
      // dois preenchidos.
      loteId: undefined,
      estoqueLocalId: values.estoqueLocalId || undefined,
    }),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Este registro é um acompanhamento e <strong>não altera o saldo</strong>. Para tirar
        material do estoque, use o ajuste — ele existe justamente para isso.
      </Alert>

      {opcoesDaUnidade.length > 0 ? (
        <SelectField
          label="Lote"
          required
          hint="É o lote que carrega a validade — e é dele que se fala."
          options={opcoesDaUnidade}
          {...form.register("estoqueLocalId")}
        />
      ) : (
        <Alert tone="info">
          Esta unidade ainda não tem material no armário. O registro fala de um lote, e por
          enquanto não há nenhum.
        </Alert>
      )}

      <SelectField
        label="O que foi observado"
        required
        options={QUALITY_TYPES.map((item) => ({ value: item.value, label: item.label }))}
        {...form.register("tipo")}
      />

      <TextareaField
        label="Descrição"
        required
        rows={3}
        placeholder="Duas caixas chegaram amassadas; a câmara fria oscilou de madrugada…"
        {...form.register("observacao")}
      />

      <InputField
        label="Quantidade afetada"
        type="number"
        step="0.001"
        min="0"
        hint="Opcional — nem toda observação tem quantidade."
        {...form.register("quantidade", {
          setValueAs: (valor) => (valor === "" ? undefined : Number(valor)),
        })}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Registrar"}
      </Button>
    </form>
  );
};
