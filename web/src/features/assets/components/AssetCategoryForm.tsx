"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createAssetCategory, updateAssetCategory } from "../actions";
import { assetCategorySchema, type AssetCategoryInput } from "../schemas";
import type { AssetCategory } from "../types";

export const AssetCategoryForm = ({ category }: { category?: AssetCategory }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(category);

  const { form, onSubmit, isSubmitting } = useResourceForm<AssetCategoryInput>({
    schema: assetCategorySchema,
    defaultValues: { nome: category?.nome ?? "" },
    action: (values) =>
      category ? updateAssetCategory(category.id, values) : createAssetCategory(values),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Mobiliário"
        error={errors.nome?.message}
        {...form.register("nome")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar categoria"}
        </Button>
      </div>
    </form>
  );
};
