"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, type Option } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createDriver, updateDriver } from "../actions";
import { driverSchema, type DriverInput } from "../schemas";
import { CNH_CATEGORIES, type Driver } from "../types";

export const DriverForm = ({ driver, users }: { driver?: Driver; users: Option[] }) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(driver);

  const { form, onSubmit, isSubmitting } = useResourceForm<DriverInput>({
    schema: driverSchema,
    defaultValues: {
      nome: driver?.nome ?? "",
      cnh: driver?.cnh ?? "",
      categoriaCnh: driver?.categoriaCnh ?? "",
      validadeCnh: driver?.validadeCnh?.slice(0, 10) ?? "",
      usuarioId: driver?.usuarioId ?? "",
    },
    action: (values) => (driver ? updateDriver(driver.id, values) : createDriver(values)),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="José da Silva"
        error={errors.nome?.message}
        {...form.register("nome")}
      />

      <FieldGrid>
        <InputField
          label="CNH"
          required
          placeholder="01234567890"
          error={errors.cnh?.message}
          {...form.register("cnh")}
        />
        <SelectField
          label="Categoria"
          required
          emptyOption="Selecione"
          options={CNH_CATEGORIES.map((categoria) => ({ value: categoria, label: categoria }))}
          error={errors.categoriaCnh?.message}
          {...form.register("categoriaCnh")}
        />
        <InputField
          label="Validade da CNH"
          type="date"
          required
          hint="O sistema avisa quando estiver perto de vencer."
          error={errors.validadeCnh?.message}
          {...form.register("validadeCnh")}
        />
      </FieldGrid>

      <SelectField
        label="Usuário do sistema"
        options={users}
        emptyOption="Sem vínculo"
        hint="Opcional: liga o motorista a um login, se ele usar o sistema."
        error={errors.usuarioId?.message}
        {...form.register("usuarioId")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar alterações" : "Cadastrar motorista"}
        </Button>
      </div>
    </form>
  );
};
