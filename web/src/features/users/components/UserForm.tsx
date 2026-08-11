"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, type Option } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createUser } from "../actions";
import { userSchema, type UserInput } from "../schemas";
import { ROLES } from "../types";

export const UserForm = ({ assignmentOptions }: { assignmentOptions: Option[] }) => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<UserInput>({
    schema: userSchema,
    defaultValues: {
      nome: "",
      email: "",
      username: "",
      senha: "",
      papelBase: "SERVIDOR",
      destino: "",
    },
    action: createUser,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
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
          placeholder="joao.silva"
          error={errors.username?.message}
          {...form.register("username")}
        />
      </FieldGrid>
      <FieldGrid>
        <InputField
          label="Senha provisória"
          type="password"
          required
          error={errors.senha?.message}
          {...form.register("senha")}
        />
        <SelectField
          label="Papel"
          required
          options={ROLES.map((role) => ({ value: role, label: humanize(role) }))}
          hint="Define o nível de acesso no sistema."
          error={errors.papelBase?.message}
          {...form.register("papelBase")}
        />
      </FieldGrid>
      <SelectField
        label="Lotação"
        emptyOption="Sem lotação"
        options={assignmentOptions}
        hint="Em nome de quem o usuário atua nos despachos."
        error={errors.destino?.message}
        {...form.register("destino")}
      />

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {result.success ? <Alert tone="success">{result.success}</Alert> : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Cadastrar usuário"}
        </Button>
      </div>
    </form>
  );
};
