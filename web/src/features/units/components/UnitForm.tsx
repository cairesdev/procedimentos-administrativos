"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createUnit } from "../actions";
import { unitSchema, type UnitInput } from "../schemas";

export const UnitForm = () => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<UnitInput>({
    schema: unitSchema,
    defaultValues: { nome: "", sigla: "" },
    action: createUnit,
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

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {result.success ? <Alert tone="success">{result.success}</Alert> : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Cadastrar unidade"}
        </Button>
      </div>
    </form>
  );
};
