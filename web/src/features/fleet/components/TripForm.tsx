"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Unit } from "@/features/units/types";
import { requestTrip } from "../actions";
import { tripSchema, type TripInput } from "../schemas";
import type { Driver, Vehicle } from "../types";

export const TripForm = ({
  units,
  vehicles,
  drivers,
}: {
  units: Unit[];
  vehicles: Vehicle[];
  drivers: Driver[];
}) => {
  const router = useRouter();
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<TripInput>({
    schema: tripSchema,
    defaultValues: {
      unidadeSolicitanteId: "",
      veiculoId: "",
      motoristaId: "",
      dataHoraDesejada: "",
      motivo: "",
      responsavel: "",
    },
    action: requestTrip,
    onDone: closeModal,
    onCreated: (result) => {
      if (result.id) router.push(`/frotas/viagens/${result.id}`);
    },
  });

  const { errors } = form.formState;

  // Veículo em manutenção ou inativo não sai; CNH vencida não dirige.
  const disponiveis = vehicles.filter((vehicle) => vehicle.ativo && !vehicle.emManutencao);
  const habilitados = drivers.filter(
    (driver) => driver.ativo && driver.diasParaVencerCnh >= 0,
  );

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      {disponiveis.length === 0 ? (
        <Alert tone="info">
          Nenhum veículo disponível: todos estão inativos ou em manutenção.
        </Alert>
      ) : null}

      <FieldGrid>
        <SelectField
          label="Unidade solicitante"
          required
          emptyOption="Selecione"
          options={units.map((unit) => ({ value: unit.id, label: unit.nome }))}
          error={errors.unidadeSolicitanteId?.message}
          {...form.register("unidadeSolicitanteId")}
        />
        <SelectField
          label="Veículo"
          required
          emptyOption="Selecione"
          options={disponiveis.map((vehicle) => ({
            value: vehicle.id,
            label: `${vehicle.placa} · ${vehicle.modelo}`,
          }))}
          error={errors.veiculoId?.message}
          {...form.register("veiculoId")}
        />
        <SelectField
          label="Motorista"
          required
          emptyOption="Selecione"
          options={habilitados.map((driver) => ({
            value: driver.id,
            label: `${driver.nome} (${driver.categoriaCnh})`,
          }))}
          hint="Motorista com CNH vencida não aparece na lista."
          error={errors.motoristaId?.message}
          {...form.register("motoristaId")}
        />
        <InputField
          label="Data e hora"
          type="datetime-local"
          required
          error={errors.dataHoraDesejada?.message}
          {...form.register("dataHoraDesejada")}
        />
        <InputField
          label="Responsável pela viagem"
          required
          placeholder="Quem acompanha o deslocamento"
          error={errors.responsavel?.message}
          {...form.register("responsavel")}
        />
      </FieldGrid>

      <TextareaField
        label="Motivo"
        required
        rows={3}
        placeholder="Transporte de pacientes para consulta em Teresina"
        error={errors.motivo?.message}
        {...form.register("motivo")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting || disponiveis.length === 0}>
          {isSubmitting ? "Enviando…" : "Solicitar viagem"}
        </Button>
      </div>
    </form>
  );
};
