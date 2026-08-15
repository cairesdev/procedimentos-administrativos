"use client";

import { useRouter } from "next/navigation";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { ZodType } from "zod";

export type ActionResult = {
  error?: string;
  success?: string;
  /** Id do registro criado, usado por assistentes que emendam etapas. */
  id?: string;
};

type Params<T extends FieldValues> = {
  schema: ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  action: (values: T) => Promise<ActionResult>;
  /** Para onde ir depois de salvar; sem isso o formulário apenas reseta. */
  redirectTo?: string;
  resetOnSuccess?: boolean;
  /** Chamado após salvar — usado para fechar o modal. */
  onDone?: () => void;
  /** Recebe o registro criado, para o assistente seguir para o próximo passo. */
  onCreated?: (result: ActionResult) => void;
};

// Valida no cliente (feedback imediato) e envia para a server action,
// que revalida com o mesmo schema antes de chamar a API.
export const useResourceForm = <T extends FieldValues>({
  schema,
  defaultValues,
  action,
  redirectTo,
  resetOnSuccess = true,
  onDone,
  onCreated,
}: Params<T>) => {
  const router = useRouter();

  const form = useForm<T>({
    resolver: zodResolver(schema) as Resolver<T>,
    defaultValues,
    mode: "onBlur",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await action(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success ?? "Registro salvo");
    if (resetOnSuccess) form.reset(defaultValues);
    onDone?.();
    onCreated?.(result);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  });

  return { form, onSubmit, isSubmitting: form.formState.isSubmitting };
};
