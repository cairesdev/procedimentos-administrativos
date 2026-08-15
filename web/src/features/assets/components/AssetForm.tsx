"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { updateAsset } from "../actions";
import { assetEditSchema, type AssetEditInput } from "../schemas";
import type { Asset, AssetCategory } from "../types";

// Tombamento e local não entram: código é definitivo e local muda por transferência.
export const AssetForm = ({
  asset,
  categories,
}: {
  asset: Asset;
  categories: AssetCategory[];
}) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<AssetEditInput>({
    schema: assetEditSchema,
    defaultValues: { nome: asset.nome, categoriaId: asset.categoriaId },
    action: (values) => updateAsset(asset.id, values),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Tombamento {asset.codigoTombamento}, em {asset.localAtualNome}. Nenhum dos dois muda por
        aqui.
      </Alert>

      <InputField
        label="Nome"
        required
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <SelectField
        label="Categoria"
        required
        emptyOption="Selecione"
        options={categories
          .filter((category) => category.ativo || category.id === asset.categoriaId)
          .map((category) => ({ value: category.id, label: category.nome }))}
        error={errors.categoriaId?.message}
        {...form.register("categoriaId")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
};
