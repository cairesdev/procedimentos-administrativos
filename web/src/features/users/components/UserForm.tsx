"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, type Option } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createUser, updateUser } from "../actions";
import { userSchema, type UserInput } from "../schemas";
import { ROLE_GROUPS, ROLES_DE_ESCOLA, type User } from "../types";

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
      destino: user?.lotacaoValor ?? "",
    },
    action: (values) => (user ? updateUser(user.id, values) : createUser(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  // A escola só é cobrada de quem trabalha numa: para o resto, a lotação segue
  // opcional, como sempre foi.
  const exigeEscola = ROLES_DE_ESCOLA.includes(form.watch("papelBase"));
  const destino = form.watch("destino") ?? "";

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
          label="Função"
          required
          options={[]}
          groups={ROLE_GROUPS.map((grupo) => ({
            label: grupo.label,
            options: grupo.roles.map((role) => ({ value: role, label: humanize(role) })),
          }))}
          hint="O módulo em que a pessoa trabalha define o que ela alcança."
          error={errors.papelBase?.message}
          {...form.register("papelBase")}
        />
      </FieldGrid>

      {/* Editável também depois da criação: a lotação decide o que a pessoa
          enxerga, e cadastrar a diretora na escola errada não podia exigir
          recadastrá-la. */}
      <SelectField
        label="Lotação"
        emptyOption={exigeEscola ? undefined : "Sem lotação"}
        required={exigeEscola}
        options={assignmentOptions}
        hint={exigeEscola
          ? "Escolha a escola: é ela que a pessoa vai enxergar, e nenhuma outra."
          : "Em nome de quem o usuário atua nos despachos."}
        error={errors.destino?.message}
        {...form.register("destino")}
      />

      {exigeEscola && !destino.startsWith("escola:") ? (
        <Alert tone="error">
          Sem uma escola, este usuário enxergaria o almoxarifado da rede inteira — que é o
          contrário do que a função significa.
        </Alert>
      ) : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar usuário"}
        </Button>
      </div>
    </form>
  );
};
