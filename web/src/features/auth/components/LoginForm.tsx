"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { authenticate } from "../actions";
import { loginSchema, type LoginInput } from "../schemas";

export const LoginForm = ({ callbackUrl }: { callbackUrl: string }) => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<LoginInput>({
    schema: loginSchema,
    defaultValues: { identificador: "", senha: "" },
    action: (values) => authenticate(values, callbackUrl),
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Usuário ou e-mail"
        required
        autoComplete="username"
        placeholder="joao.silva"
        error={errors.identificador?.message}
        {...form.register("identificador")}
      />
      <InputField
        label="Senha"
        type="password"
        required
        autoComplete="current-password"
        error={errors.senha?.message}
        {...form.register("senha")}
      />

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
};
