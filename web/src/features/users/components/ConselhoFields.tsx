"use client";

import { useWatch, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { assinaProntuario } from "../conselho";

/**
 * Os três campos do conselho, para as **duas** telas que criam usuário.
 *
 * Só aparecem para quem assina prontuário. Pedir CRM ao setor de compras seria
 * campo que ninguém preenche; não pedir ao médico seria descobrir a falta no
 * meio do plantão, com a triagem recusando o fecho e ninguém entendendo por
 * quê — a saída está noutra tela, com outra permissão.
 *
 * **O papel é observado aqui dentro, com `useWatch`, e não recebido por
 * propriedade.** Recebido, ele dependia de o formulário-pai se redesenhar a
 * cada troca do select: quem esquecesse o `watch` no pai teria um campo que
 * aparece na edição (onde o papel já vem certo do banco) e não aparece na
 * criação — que foi exatamente o defeito relatado. Assinando o controle, o
 * componente reage sozinho e o pai não tem como errar.
 */
export const ConselhoFields = <T extends FieldValues>({
  form,
}: {
  form: UseFormReturn<T>;
}) => {
  const papelBase = useWatch({
    control: form.control,
    name: "papelBase" as Path<T>,
  }) as string | undefined;

  if (!assinaProntuario(papelBase ?? "")) return null;

  const { errors } = form.formState;
  const campo = (nome: string) => form.register(nome as Path<T>);
  const erro = (nome: string) =>
    (errors as Record<string, { message?: string } | undefined>)[nome]?.message;

  return (
    <FieldGrid>
      <SelectField
        label="Conselho"
        required
        options={[
          { value: "", label: "Selecione" },
          { value: "CRM", label: "CRM (medicina)" },
          { value: "COREN", label: "COREN (enfermagem)" },
        ]}
        error={erro("conselhoTipo")}
        {...campo("conselhoTipo")}
      />
      <InputField
        label="Número"
        required
        hint="É o carimbo impresso na ficha de atendimento."
        error={erro("conselhoNumero")}
        {...campo("conselhoNumero")}
      />
      <InputField
        label="UF do conselho"
        required
        maxLength={2}
        error={erro("conselhoUf")}
        {...campo("conselhoUf")}
      />
    </FieldGrid>
  );
};
