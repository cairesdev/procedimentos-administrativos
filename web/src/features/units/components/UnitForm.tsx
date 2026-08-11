"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createUnit, updateUnit } from "../actions";
import { unitSchema, type UnitInput } from "../schemas";
import type { Unit } from "../types";

export const UnitForm = ({ unit }: { unit?: Unit }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(unit);

  const { form, onSubmit, isSubmitting } = useResourceForm<UnitInput>({
    schema: unitSchema,
    defaultValues: { nome: unit?.nome ?? "", sigla: unit?.sigla ?? "" },
    action: (values) => (unit ? updateUnit(unit.id, values) : createUnit(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Secretaria Municipal de Saúde"
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <InputField
        label="Sigla"
        placeholder="SMS"
        error={errors.sigla?.message}
        {...form.register("sigla")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar unidade"}
        </Button>
      </div>
    </form>
  );
};
