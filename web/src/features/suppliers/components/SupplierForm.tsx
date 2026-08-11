"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createSupplier } from "../actions";
import { supplierSchema, type SupplierInput } from "../schemas";

export const SupplierForm = () => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<SupplierInput>({
    schema: supplierSchema as never,
    defaultValues: {
      documento: "",
      razaoSocial: "",
      endereco: "",
      email: "",
      telefone: "",
      inscricaoEstadual: "",
      inscricaoMunicipal: "",
    },
    action: createSupplier,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Fornecedor é cadastro compartilhado entre as prefeituras; alterações ficam registradas em
        histórico.
      </Alert>

      <FieldGrid>
        <InputField
          label="CNPJ ou CPF"
          required
          placeholder="Somente números"
          error={errors.documento?.message}
          {...form.register("documento")}
        />
        <InputField
          label="Razão social"
          required
          error={errors.razaoSocial?.message}
          {...form.register("razaoSocial")}
        />
      </FieldGrid>

      <InputField label="Endereço" error={errors.endereco?.message} {...form.register("endereco")} />

      <FieldGrid>
        <InputField
          label="E-mail"
          type="email"
          error={errors.email?.message}
          {...form.register("email")}
        />
        <InputField label="Telefone" error={errors.telefone?.message} {...form.register("telefone")} />
        <InputField
          label="Inscrição estadual"
          error={errors.inscricaoEstadual?.message}
          {...form.register("inscricaoEstadual")}
        />
        <InputField
          label="Inscrição municipal"
          error={errors.inscricaoMunicipal?.message}
          {...form.register("inscricaoMunicipal")}
        />
      </FieldGrid>

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {result.success ? <Alert tone="success">{result.success}</Alert> : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Cadastrar fornecedor"}
        </Button>
      </div>
    </form>
  );
};
