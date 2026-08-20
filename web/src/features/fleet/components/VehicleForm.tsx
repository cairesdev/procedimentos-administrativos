"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, type Option } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createVehicle, updateVehicle } from "../actions";
import { vehicleSchema, type VehicleInput } from "../schemas";
import type { Vehicle } from "../types";

export const VehicleForm = ({
  vehicle,
  units,
}: {
  vehicle?: Vehicle;
  units: Option[];
}) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(vehicle);

  const { form, onSubmit, isSubmitting } = useResourceForm<VehicleInput>({
    schema: vehicleSchema,
    defaultValues: {
      placa: vehicle?.placa ?? "",
      modelo: vehicle?.modelo ?? "",
      ano: vehicle?.ano ? String(vehicle.ano) : "",
      tipo: vehicle?.tipo ?? "",
      unidadeId: vehicle?.unidadeId ?? "",
    },
    action: (values) => (vehicle ? updateVehicle(vehicle.id, values) : createVehicle(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <FieldGrid>
        <InputField
          label="Placa"
          required
          placeholder="ABC1D23"
          disabled={isEditing}
          hint={isEditing ? "A placa identifica o veículo e não muda por aqui." : undefined}
          error={errors.placa?.message}
          {...form.register("placa")}
        />
        <InputField
          label="Modelo"
          required
          placeholder="Fiat Strada"
          error={errors.modelo?.message}
          {...form.register("modelo")}
        />
        <InputField
          label="Ano"
          type="number"
          min={1950}
          max={2100}
          placeholder="2022"
          error={errors.ano?.message}
          {...form.register("ano")}
        />
        <InputField
          label="Tipo"
          placeholder="Utilitário, ambulância…"
          error={errors.tipo?.message}
          {...form.register("tipo")}
        />
      </FieldGrid>

      <SelectField
        label="Secretaria dona"
        options={units}
        emptyOption="Frota central (qualquer unidade pode pedir)"
        hint="Com dono definido, só ela solicita — salvo se o compartilhamento estiver ligado."
        error={errors.unidadeId?.message}
        {...form.register("unidadeId")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar veículo"}
        </Button>
      </div>
    </form>
  );
};
