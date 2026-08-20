"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createEntityAdmin } from "../actions";
import { firstAdminSchema, type FirstAdminInput } from "../schemas";
import type { Tenant } from "../types";

export const EntityAdminForm = ({ tenant }: { tenant: Tenant }) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<FirstAdminInput>({
    schema: firstAdminSchema as never,
    defaultValues: { nome: "", email: "", username: "", senha: "" },
    action: (values) => createEntityAdmin(tenant.id, values),
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Nasce com papel ADMIN e passa a cadastrar os demais servidores de {tenant.nome}. Combine a
        senha provisória por um canal seguro e peça a troca no primeiro acesso.
      </Alert>

      <InputField
        label="Nome completo"
        required
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <FieldGrid>
        <InputField
          label="E-mail"
          type="email"
          required
          error={errors.email?.message}
          {...form.register("email")}
        />
        <InputField
          label="Nome de usuário"
          required
          placeholder="admin.municipio"
          error={errors.username?.message}
          {...form.register("username")}
        />
      </FieldGrid>
      <InputField
        label="Senha provisória"
        type="password"
        required
        error={errors.senha?.message}
        {...form.register("senha")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando…" : "Criar administrador"}
        </Button>
      </div>
    </form>
  );
};
