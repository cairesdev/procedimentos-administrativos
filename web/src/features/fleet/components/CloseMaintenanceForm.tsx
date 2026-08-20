"use client";

import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { closeMaintenance } from "../actions";
import { closeMaintenanceSchema, type CloseMaintenanceInput } from "../schemas";
import type { Maintenance } from "../types";

export const CloseMaintenanceForm = ({ maintenance }: { maintenance: Maintenance }) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<CloseMaintenanceInput>({
    schema: closeMaintenanceSchema,
    defaultValues: {
      dataFim: new Date().toISOString().slice(0, 10),
      custo: maintenance.custo ?? undefined,
      descricao: maintenance.descricao ?? "",
    },
    action: (values) => closeMaintenance(maintenance.id, values),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <FieldGrid>
        <InputField
          label="Encerrada em"
          type="date"
          required
          hint={`Aberta em ${maintenance.dataInicio.slice(0, 10).split("-").reverse().join("/")}.`}
          error={errors.dataFim?.message}
          {...form.register("dataFim")}
        />
        <InputField
          label="Custo (R$)"
          type="number"
          step="0.01"
          error={errors.custo?.message}
          {...form.register("custo")}
        />
      </FieldGrid>

      <TextareaField
        label="O que foi feito"
        rows={3}
        error={errors.descricao?.message}
        {...form.register("descricao")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Encerrando…" : "Encerrar e liberar veículo"}
        </Button>
      </div>
    </form>
  );
};
