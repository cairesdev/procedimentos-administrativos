"use client";

import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { adminLogin } from "../actions";
import { adminLoginSchema, type AdminLoginInput } from "../schemas";

export const AdminLoginForm = () => {
  const { form, onSubmit, isSubmitting } = useResourceForm<AdminLoginInput>({
    schema: adminLoginSchema as never,
    defaultValues: { email: "", senha: "" },
    action: adminLogin,
    resetOnSuccess: false,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="E-mail"
        type="email"
        required
        autoComplete="username"
        error={errors.email?.message}
        {...form.register("email")}
      />
      <InputField
        label="Senha"
        type="password"
        required
        autoComplete="current-password"
        error={errors.senha?.message}
        {...form.register("senha")}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
};
