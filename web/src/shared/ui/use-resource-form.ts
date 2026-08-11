"use client";

import { useState } from "react";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

export type ActionResult = { error?: string; success?: string };

type Params<T extends FieldValues> = {
  schema: ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  action: (values: T) => Promise<ActionResult>;
};

// Valida no cliente (feedback imediato) e envia para a server action,
// que revalida com o mesmo schema antes de chamar a API.
export const useResourceForm = <T extends FieldValues>({
  schema,
  defaultValues,
  action,
}: Params<T>) => {
  const [result, setResult] = useState<ActionResult>({});

  const form = useForm<T>({
    resolver: zodResolver(schema) as Resolver<T>,
    defaultValues,
    mode: "onBlur",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setResult({});
    const response = await action(values);
    setResult(response);
    if (response.success) form.reset(defaultValues);
  });

  return { form, onSubmit, result, isSubmitting: form.formState.isSubmitting };
};
