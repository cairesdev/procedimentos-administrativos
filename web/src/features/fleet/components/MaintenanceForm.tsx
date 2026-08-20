"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { openMaintenance } from "../actions";
import { maintenanceSchema, type MaintenanceInput } from "../schemas";
import type { Vehicle } from "../types";

export const MaintenanceForm = ({ vehicles }: { vehicles: Vehicle[] }) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<MaintenanceInput>({
    schema: maintenanceSchema,
    defaultValues: {
      veiculoId: "",
      tipo: "PREVENTIVA",
      dataInicio: new Date().toISOString().slice(0, 10),
      descricao: "",
      oficina: "",
    },
    action: openMaintenance,
    onDone: closeModal,
  });

  const { errors } = form.formState;
  // Veículo já em manutenção não pode abrir outra.
  const elegiveis = vehicles.filter((vehicle) => !vehicle.emManutencao);

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Enquanto a manutenção estiver aberta, o veículo não pode ser solicitado.
      </Alert>

      <FieldGrid>
        <SelectField
          label="Veículo"
          required
          emptyOption="Selecione"
          options={elegiveis.map((vehicle) => ({
            value: vehicle.id,
            label: `${vehicle.placa} · ${vehicle.modelo}`,
          }))}
          error={errors.veiculoId?.message}
          {...form.register("veiculoId")}
        />
        <SelectField
          label="Tipo"
          required
          options={[
            { value: "PREVENTIVA", label: "Preventiva" },
            { value: "CORRETIVA", label: "Corretiva" },
          ]}
          error={errors.tipo?.message}
          {...form.register("tipo")}
        />
        <InputField
          label="Início"
          type="date"
          required
          error={errors.dataInicio?.message}
          {...form.register("dataInicio")}
        />
        <InputField
          label="Oficina"
          placeholder="Oficina do Zé"
          error={errors.oficina?.message}
          {...form.register("oficina")}
        />
      </FieldGrid>

      <TextareaField
        label="Descrição"
        rows={3}
        placeholder="Troca de óleo e filtros"
        error={errors.descricao?.message}
        {...form.register("descricao")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting || elegiveis.length === 0}>
          {isSubmitting ? "Abrindo…" : "Abrir manutenção"}
        </Button>
      </div>
    </form>
  );
};
