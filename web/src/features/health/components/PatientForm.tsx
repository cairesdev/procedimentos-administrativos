"use client";

import { InputField, SelectField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { FieldGrid } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { patientSchema, type PatientInput } from "../schemas";
import { savePatient } from "../actions";
import type { Patient } from "../types";

/**
 * O cadastro do paciente — cinco documentos, todos opcionais.
 *
 * O SUS registra por Cartão, o Bolsa Família por NIS, e quem chega de carro
 * tem a CNH no bolso e mais nada. Um campo obrigatório aqui obrigaria a
 * recepção a cadastrar a mesma pessoa de novo na segunda visita, que é como
 * nascem prontuários duplicados.
 *
 * **Nome da mãe fica junto do nome, e não no fim.** É o desempatador real
 * entre homônimos na saúde pública, e é por isso que o papel o traz logo
 * abaixo do nome.
 */
export const PatientForm = ({ paciente }: { paciente?: Patient }) => {
  const { form, onSubmit } = useResourceForm<PatientInput>({
    schema: patientSchema,
    defaultValues: {
      nome: paciente?.nome ?? "",
      nomeMae: paciente?.nomeMae ?? "",
      dataNascimento: paciente?.dataNascimento ?? "",
      sexo: (paciente?.sexo as "M" | "F" | "I") ?? "",
      cns: paciente?.cns ?? "",
      cpf: paciente?.cpf ?? "",
      nis: paciente?.nis ?? "",
      cnh: paciente?.cnh ?? "",
      rg: paciente?.rg ?? "",
      endereco: paciente?.endereco ?? "",
      cidade: paciente?.cidade ?? "",
      uf: paciente?.uf ?? "",
      telefone: paciente?.telefone ?? "",
      email: paciente?.email ?? "",
    },
    action: (values) => savePatient(values, paciente?.id),
    resetOnSuccess: !paciente,
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={onSubmit}>
      <FieldGrid>
        <InputField
          label="Nome do paciente"
          wide
          error={errors.nome?.message}
          {...form.register("nome")}
        />
        <InputField
          label="Nome da mãe"
          wide
          hint="É o que separa dois pacientes com o mesmo nome."
          {...form.register("nomeMae")}
        />
        <InputField
          label="Data de nascimento"
          type="date"
          {...form.register("dataNascimento")}
        />
        <SelectField
          label="Sexo"
          options={[
            { value: "", label: "Não informado" },
            { value: "F", label: "Feminino" },
            { value: "M", label: "Masculino" },
            { value: "I", label: "Ignorado" },
          ]}
          {...form.register("sexo")}
        />

        <InputField
          label="Cartão do SUS"
          hint="Quinze dígitos."
          {...form.register("cns")}
        />
        <InputField label="CPF" {...form.register("cpf")} />
        <InputField label="NIS" {...form.register("nis")} />
        <InputField label="CNH" {...form.register("cnh")} />
        <InputField label="RG" {...form.register("rg")} />

        <InputField label="Endereço" wide {...form.register("endereco")} />
        <InputField label="Cidade" {...form.register("cidade")} />
        <InputField label="UF" maxLength={2} {...form.register("uf")} />
        <InputField label="Telefone" {...form.register("telefone")} />
        {/*
          O e-mail é contato administrativo. Nenhum dado clínico sai por
          e-mail — resultado de exame não vai por aqui.
        */}
        <InputField
          label="E-mail"
          type="email"
          hint="Contato administrativo. Nada clínico é enviado por e-mail."
          {...form.register("email")}
        />
      </FieldGrid>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : paciente ? "Salvar cadastro" : "Cadastrar paciente"}
      </Button>
    </form>
  );
};
