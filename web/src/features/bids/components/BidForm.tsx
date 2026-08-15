"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { CurrencyField } from "@/shared/ui/CurrencyField";
import { TagSelect } from "@/shared/ui/TagSelect";
import { humanize } from "@/shared/ui/labels";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Unit } from "@/features/units/types";
import { createBid, updateBid } from "../actions";
import { bidSchema, type BidInput } from "../schemas";
import { BID_MODALITIES, type Bid } from "../types";

export const BidForm = ({
  units,
  bid,
  selectedUnits = [],
  onCreated,
}: {
  units: Unit[];
  bid?: Bid;
  selectedUnits?: string[];
  /** Usado pelo assistente: segue para o passo seguinte em vez de redirecionar. */
  onCreated?: (record: { id: string; numero: string }) => void;
}) => {
  const isEditing = Boolean(bid);
  const closeModal = useModalClose();
  const { form, onSubmit, isSubmitting } = useResourceForm<BidInput>({
    schema: bidSchema as never,
    defaultValues: {
      numero: bid?.numero ?? "",
      resumo: bid?.resumo ?? "",
      objeto: bid?.objeto ?? "",
      modalidade: bid?.modalidade ?? "PREGAO_ELETRONICO",
      dataAssinatura: bid?.dataAssinatura?.slice(0, 10) ?? "",
      valorTotal: bid?.valorTotal ?? 0,
      unidadesDestinadas: selectedUnits,
    },
    action: (values) => (bid ? updateBid(bid.id, values) : createBid(values)),
    redirectTo: isEditing || onCreated ? undefined : "/licitacoes",
    resetOnSuccess: false,
    onDone: closeModal,
    onCreated: (result) =>
      result.id && onCreated?.({ id: result.id, numero: form.getValues("numero") }),
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <FieldGrid>
        <InputField
          label="Número/ano"
          required
          placeholder="025/2026"
          error={errors.numero?.message}
          {...form.register("numero")}
        />
        <SelectField
          label="Modalidade"
          required
          options={BID_MODALITIES.map((modality) => ({
            value: modality,
            label: humanize(modality),
          }))}
          error={errors.modalidade?.message}
          {...form.register("modalidade")}
        />
        <InputField
          label="Data de assinatura"
          type="date"
          required
          error={errors.dataAssinatura?.message}
          {...form.register("dataAssinatura")}
        />
        <CurrencyField control={form.control} name="valorTotal" label="Valor total" required />
      </FieldGrid>

      <InputField label="Resumo" error={errors.resumo?.message} {...form.register("resumo")} />
      <TextareaField
        label="Objeto"
        required
        error={errors.objeto?.message}
        {...form.register("objeto")}
      />
      <TagSelect
        control={form.control}
        name="unidadesDestinadas"
        label="Unidades destinadas"
        required
        options={units.map((unit) => ({ value: unit.id, label: unit.nome }))}
        searchPlaceholder="Buscar secretaria…"
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar licitação"}
        </Button>
      </div>
    </form>
  );
};
