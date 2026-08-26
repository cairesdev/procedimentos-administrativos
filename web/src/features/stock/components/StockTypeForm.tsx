"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createStockType, updateStockType } from "../actions";
import { stockTypeSchema, type StockTypeInput } from "../schemas";
import type { StockType } from "../types";

const SITUACAO = [
  { value: "true", label: "Ativo" },
  { value: "false", label: "Inativo" },
];

export const StockTypeForm = ({ stockType }: { stockType?: StockType }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(stockType);

  const { form, onSubmit, isSubmitting } = useResourceForm<StockTypeInput>({
    schema: stockTypeSchema,
    defaultValues: { nome: stockType?.nome ?? "", ativo: stockType?.ativo ?? true },
    action: (values) =>
      stockType ? updateStockType(stockType.id, values) : createStockType(values),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Alimentação escolar"
        hint="Separa alimentação, limpeza e expediente dentro do mesmo almoxarifado."
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
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar tipo"}
        </Button>
      </div>
    </form>
  );
};
