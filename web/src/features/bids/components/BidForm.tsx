"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Unit } from "@/features/units/types";
import { createBid } from "../actions";
import { bidSchema, type BidInput } from "../schemas";
import { BID_MODALITIES } from "../types";

export const BidForm = ({ units }: { units: Unit[] }) => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<BidInput>({
    schema: bidSchema as never,
    defaultValues: {
      numero: "",
      resumo: "",
      objeto: "",
      modalidade: "PREGAO_ELETRONICO",
      dataAssinatura: "",
      valorTotal: 0,
      unidadesDestinadas: [],
    },
    action: createBid,
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
        <InputField
          label="Valor total"
          type="number"
          step="0.01"
          required
          error={errors.valorTotal?.message}
          {...form.register("valorTotal")}
        />
      </FieldGrid>

      <InputField label="Resumo" error={errors.resumo?.message} {...form.register("resumo")} />
      <TextareaField
        label="Objeto"
        required
        error={errors.objeto?.message}
        {...form.register("objeto")}
      />
      <SelectField
        label="Unidades destinadas"
        required
        multiple
        options={units.map((unit) => ({ value: unit.id, label: unit.nome }))}
        hint="Segure Ctrl para escolher mais de uma."
        error={errors.unidadesDestinadas?.message}
        {...form.register("unidadesDestinadas")}
      />

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {result.success ? <Alert tone="success">{result.success}</Alert> : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Cadastrar licitação"}
        </Button>
      </div>
    </form>
  );
};
