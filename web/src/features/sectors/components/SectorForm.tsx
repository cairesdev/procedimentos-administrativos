"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { humanize } from "@/shared/ui/labels";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createSector, updateSector } from "../actions";
import { sectorSchema, type SectorInput } from "../schemas";
import { SECTOR_TYPES, type Sector } from "../types";

export const SectorForm = ({ sector }: { sector?: Sector }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(sector);
  const { form, onSubmit, isSubmitting } = useResourceForm<SectorInput>({
    schema: sectorSchema,
    defaultValues: { nome: sector?.nome ?? "", tipo: sector?.tipo ?? "PROTOCOLO" },
    action: (values) => (sector ? updateSector(sector.id, values) : createSector(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Setor de Compras"
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <SelectField
        label="Tipo funcional"
        required
        options={SECTOR_TYPES.map((type) => ({ value: type, label: humanize(type) }))}
        error={errors.tipo?.message}
        {...form.register("tipo")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar setor"}
        </Button>
      </div>
    </form>
  );
};
