"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createWarehouse, updateWarehouse } from "../actions";
import { warehouseSchema, type WarehouseInput } from "../schemas";
import type { Warehouse } from "../types";

const SITUACAO = [
  { value: "true", label: "Ativo" },
  { value: "false", label: "Inativo" },
];

export const WarehouseForm = ({ warehouse }: { warehouse?: Warehouse }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(warehouse);

  const { form, onSubmit, isSubmitting } = useResourceForm<WarehouseInput>({
    schema: warehouseSchema,
    defaultValues: { nome: warehouse?.nome ?? "", ativo: warehouse?.ativo ?? true },
    action: (values) =>
      warehouse ? updateWarehouse(warehouse.id, values) : createWarehouse(values),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Almoxarifado da Educação"
        hint="Um por secretaria costuma ser o suficiente."
        error={errors.nome?.message}
        {...form.register("nome")}
      />

      {isEditing ? (
        <SelectField
          label="Situação"
          options={SITUACAO}
          hint="Inativo some das listas, mas o histórico continua."
          {...form.register("ativo", { setValueAs: (valor) => valor === "true" || valor === true })}
        />
      ) : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar almoxarifado"}
        </Button>
      </div>
    </form>
  );
};
