"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createSupplier, updateSupplier } from "../actions";
import { supplierSchema, type SupplierInput } from "../schemas";
import type { Supplier } from "../types";

export const SupplierForm = ({ supplier }: { supplier?: Supplier }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(supplier);
  const { form, onSubmit, isSubmitting } = useResourceForm<SupplierInput>({
    schema: supplierSchema as never,
    defaultValues: {
      documento: supplier?.documento ?? "",
      razaoSocial: supplier?.razaoSocial ?? "",
      endereco: supplier?.endereco ?? "",
      email: supplier?.email ?? "",
      telefone: supplier?.telefone ?? "",
      inscricaoEstadual: supplier?.inscricaoEstadual ?? "",
      inscricaoMunicipal: supplier?.inscricaoMunicipal ?? "",
    },
    action: (values) => (supplier ? updateSupplier(supplier.id, values) : createSupplier(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
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
          readOnly={isEditing}
          placeholder="Somente números"
          hint={isEditing ? "O documento identifica o cadastro e não muda." : undefined}
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

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar fornecedor"}
        </Button>
      </div>
    </form>
  );
};
