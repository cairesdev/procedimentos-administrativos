"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createSector } from "../actions";
import { sectorSchema, type SectorInput } from "../schemas";
import { SECTOR_TYPES } from "../types";

export const SectorForm = () => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<SectorInput>({
    schema: sectorSchema,
    defaultValues: { nome: "", tipo: "PROTOCOLO" },
    action: createSector,
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

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {result.success ? <Alert tone="success">{result.success}</Alert> : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Cadastrar setor"}
        </Button>
      </div>
    </form>
  );
};
