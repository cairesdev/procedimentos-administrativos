"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createDepartment } from "../actions";
import { departmentSchema, type DepartmentInput } from "../schemas";
import type { Sector } from "../types";

export const DepartmentForm = ({ sectors }: { sectors: Sector[] }) => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<DepartmentInput>({
    schema: departmentSchema,
    defaultValues: { setorId: "", nome: "", categoriaAtendimento: "" },
    action: createDepartment,
  });

  const { errors } = form.formState;

  if (sectors.length === 0) {
    return <Alert tone="info">Cadastre um setor antes de criar departamentos.</Alert>;
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <SelectField
        label="Setor"
        required
        emptyOption="Selecione"
        options={sectors.map((sector) => ({ value: sector.id, label: sector.nome }))}
        error={errors.setorId?.message}
        {...form.register("setorId")}
      />
      <InputField
        label="Nome"
        required
        placeholder="Recursos Humanos"
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <InputField
        label="Categoria de atendimento"
        placeholder="Folha de pagamento"
        hint="Departamento pode ser destino direto no fluxo."
        error={errors.categoriaAtendimento?.message}
        {...form.register("categoriaAtendimento")}
      />

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {result.success ? <Alert tone="success">{result.success}</Alert> : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Cadastrar departamento"}
        </Button>
      </div>
    </form>
  );
};
