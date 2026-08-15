"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { openInventory } from "../actions";
import { inventorySchema, type InventoryInput } from "../schemas";
import type { AssetLocation } from "../types";

export const InventoryForm = ({ locations }: { locations: AssetLocation[] }) => {
  const router = useRouter();
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<InventoryInput>({
    schema: inventorySchema,
    defaultValues: { localId: "", dataInicio: new Date().toISOString().slice(0, 10) },
    action: openInventory,
    onDone: closeModal,
    onCreated: (result) => {
      if (result.id) router.push(`/patrimonio/inventarios/${result.id}`);
    },
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <SelectField
        label="Local a conferir"
        required
        emptyOption="Selecione"
        options={locations
          .filter((location) => location.ativo)
          .map((location) => ({
            value: location.id,
            label: `${location.codigo} · ${location.nome} (${location.bens} bens)`,
          }))}
        hint="Só um inventário aberto por local ao mesmo tempo."
        error={errors.localId?.message}
        {...form.register("localId")}
      />
      <InputField
        label="Data de início"
        type="date"
        required
        error={errors.dataInicio?.message}
        {...form.register("dataInicio")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Abrindo…" : "Abrir inventário"}
        </Button>
      </div>
    </form>
  );
};
