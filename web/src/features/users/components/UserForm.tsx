"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, type Option } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createUser, updateUser } from "../actions";
import { userSchema, type UserInput } from "../schemas";
import { ROLES, type User } from "../types";

export const UserForm = ({
  assignmentOptions,
  user,
}: {
  assignmentOptions: Option[];
  user?: User;
}) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(user);
  const { form, onSubmit, isSubmitting } = useResourceForm<UserInput>({
    schema: userSchema,
    defaultValues: {
      nome: user?.nome ?? "",
      email: user?.email ?? "",
      username: "",
      senha: "",
      papelBase: user?.papelBase ?? "SERVIDOR",
      destino: "",
    },
    action: (values) => (user ? updateUser(user.id, values) : createUser(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
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
        {isEditing ? null : (
          <InputField
            label="Nome de usuário"
            required
            placeholder="joao.silva"
            error={errors.username?.message}
            {...form.register("username")}
          />
        )}
      </FieldGrid>
      <FieldGrid>
        <InputField
          label={isEditing ? "Nova senha" : "Senha provisória"}
          type="password"
          required={!isEditing}
          hint={isEditing ? "Deixe em branco para manter a senha atual." : undefined}
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
      {isEditing ? null : (
        <SelectField
          label="Lotação"
          emptyOption="Sem lotação"
          options={assignmentOptions}
          hint="Em nome de quem o usuário atua nos despachos."
          error={errors.destino?.message}
          {...form.register("destino")}
        />
      )}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar usuário"}
        </Button>
      </div>
    </form>
  );
};
