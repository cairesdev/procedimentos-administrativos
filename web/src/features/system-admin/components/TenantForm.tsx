"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { TagSelect } from "@/shared/ui/TagSelect";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createTenant, updateTenant } from "../actions";
import { tenantSchema, type TenantInput } from "../schemas";
import { MODULES, type Tenant } from "../types";

export const TenantForm = ({ tenant }: { tenant?: Tenant }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(tenant);

  const { form, onSubmit, isSubmitting } = useResourceForm<TenantInput>({
    schema: tenantSchema as never,
    defaultValues: {
      cnpj: tenant?.cnpj ?? "",
      nome: tenant?.nome ?? "",
      uf: tenant?.uf ?? "",
      municipio: tenant?.municipio ?? "",
      endereco: tenant?.endereco ?? "",
      modulos: tenant?.modulos ?? ["PROCESSOS"],
    },
    action: (values) => (tenant ? updateTenant(tenant.id, values) : createTenant(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <FieldGrid>
        <InputField
          label="CNPJ"
          required
          placeholder="Somente números"
          error={errors.cnpj?.message}
          {...form.register("cnpj")}
        />
        <InputField
          label="Nome"
          required
          placeholder="Prefeitura Municipal de…"
          error={errors.nome?.message}
          {...form.register("nome")}
        />
        <InputField
          label="Município"
          required
          error={errors.municipio?.message}
          {...form.register("municipio")}
        />
        <InputField
          label="UF"
          required
          maxLength={2}
          placeholder="MA"
          error={errors.uf?.message}
          {...form.register("uf")}
        />
      </FieldGrid>

      <InputField label="Endereço" error={errors.endereco?.message} {...form.register("endereco")} />

      {isEditing ? null : (
        <TagSelect
          control={form.control}
          name="modulos"
          label="Módulos habilitados"
          options={MODULES.map((module) => ({ value: module, label: module.toLowerCase() }))}
          hint="Define o que a prefeitura enxerga no menu."
          searchPlaceholder="Buscar módulo…"
        />
      )}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar prefeitura"}
        </Button>
      </div>
    </form>
  );
};
