"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { TagSelect } from "@/shared/ui/TagSelect";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Unit } from "@/features/units/types";
import { updateContract } from "../actions";
import { contractEditSchema, type ContractEditInput } from "../schemas";
import type { Contract } from "../types";

export const ContractEditForm = ({
  contract,
  units,
  selectedUnits = [],
}: {
  contract: Contract;
  units: Unit[];
  selectedUnits?: string[];
}) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<ContractEditInput>({
    schema: contractEditSchema as never,
    defaultValues: {
      dataInicio: contract.dataInicio.slice(0, 10),
      dataFim: contract.dataFim.slice(0, 10),
      fiscalNomeMatricula: "",
      unidadesDestinadas: selectedUnits,
    },
    action: (values) => updateContract(contract.id, values),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Número, valor e itens não mudam depois de criado — solicitações emitidas dependem deles.
      </Alert>

      <FieldGrid>
        <InputField
          label="Início da vigência"
          type="date"
          required
          error={errors.dataInicio?.message}
          {...form.register("dataInicio")}
        />
        <InputField
          label="Fim da vigência"
          type="date"
          required
          error={errors.dataFim?.message}
          {...form.register("dataFim")}
        />
      </FieldGrid>

      <InputField
        label="Fiscal do contrato"
        placeholder="Maria Fiscal — mat. 1234"
        {...form.register("fiscalNomeMatricula")}
      />

      <TagSelect
        control={form.control}
        name="unidadesDestinadas"
        label="Unidades destinadas"
        required
        options={units.map((unit) => ({ value: unit.id, label: unit.nome }))}
        searchPlaceholder="Buscar secretaria…"
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
};
