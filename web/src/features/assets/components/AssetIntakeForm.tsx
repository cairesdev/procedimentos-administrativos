"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Supplier } from "@/features/suppliers/types";
import { updateAssetIntake } from "../actions";
import { assetIntakeEditSchema, type AssetIntakeEditInput } from "../schemas";
import type { AssetIntake } from "../types";

// Edição só da nota: os lotes já viraram bens com tombamento definitivo.
export const AssetIntakeForm = ({
  intake,
  suppliers,
}: {
  intake: AssetIntake;
  suppliers: Supplier[];
}) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<AssetIntakeEditInput>({
    schema: assetIntakeEditSchema,
    defaultValues: {
      data: intake.data.slice(0, 10),
      fornecedorId: intake.fornecedorId ?? "",
      notaFiscal: intake.notaFiscal ?? "",
    },
    action: (values) => updateAssetIntake(intake.id, values),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Os {intake.bens} bens desta entrada já estão tombados. Aqui só se corrigem os dados da nota.
      </Alert>

      <InputField
        label="Data da entrada"
        type="date"
        required
        error={errors.data?.message}
        {...form.register("data")}
      />
      <SelectField
        label="Fornecedor"
        emptyOption="Não informado"
        options={suppliers.map((supplier) => ({
          value: supplier.id,
          label: supplier.razaoSocial,
        }))}
        error={errors.fornecedorId?.message}
        {...form.register("fornecedorId")}
      />
      <InputField
        label="Nota fiscal"
        placeholder="12345"
        error={errors.notaFiscal?.message}
        {...form.register("notaFiscal")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
};
