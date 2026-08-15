"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, type Option } from "@/shared/ui/form-field";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createAssetLocation, updateAssetLocation } from "../actions";
import { assetLocationSchema, type AssetLocationInput } from "../schemas";
import type { AssetLocation } from "../types";

export const AssetLocationForm = ({
  location,
  units,
}: {
  location?: AssetLocation;
  units: Option[];
}) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(location);

  const { form, onSubmit, isSubmitting } = useResourceForm<AssetLocationInput>({
    schema: assetLocationSchema,
    defaultValues: {
      codigo: location?.codigo ?? "",
      nome: location?.nome ?? "",
      unidadeId: location?.unidadeId ?? "",
    },
    action: (values) =>
      location ? updateAssetLocation(location.id, values) : createAssetLocation(values),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Código"
        required
        placeholder="001"
        inputMode="numeric"
        disabled={isEditing}
        hint={
          isEditing
            ? "O código já compõe o tombamento dos bens e não pode mudar."
            : "Prefixo do tombamento: 001 gera 001-001, 001-002…"
        }
        error={errors.codigo?.message}
        {...form.register("codigo")}
      />
      <InputField
        label="Nome"
        required
        placeholder="Escola Municipal João Ribeiro"
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <SelectField
        label="Unidade responsável"
        options={units}
        emptyOption="Sem vínculo"
        error={errors.unidadeId?.message}
        {...form.register("unidadeId")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar local"}
        </Button>
      </div>
    </form>
  );
};
