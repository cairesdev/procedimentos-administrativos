"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Sector } from "@/features/sectors/types";
import { createSubject, updateSubject } from "../actions";
import { subjectSchema, type SubjectInput } from "../schemas";
import type { ProtocolSubject } from "../types";

export const SubjectForm = ({
  assunto,
  setores,
}: {
  assunto?: ProtocolSubject;
  setores: Sector[];
}) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<SubjectInput>({
    schema: subjectSchema as never,
    defaultValues: {
      nome: assunto?.nome ?? "",
      descricao: assunto?.descricao ?? "",
      setorId: assunto?.setorId ?? "",
      prazoDias: assunto?.prazoDias ?? undefined,
      ativo: assunto?.ativo ?? true,
    },
    action: (values) => (assunto ? updateSubject(assunto.id, values) : createSubject(values)),
    onDone: closeModal,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        O setor definido aqui recebe o atendimento direto, sem triagem. Sem setor, o processo segue
        a primeira etapa do fluxo de atendimento externo.
      </Alert>

      <InputField
        label="Assunto"
        required
        placeholder="Ex.: Certidão negativa de débitos"
        error={form.formState.errors.nome?.message}
        {...form.register("nome")}
      />

      <TextareaField
        label="Descrição"
        rows={3}
        hint="Aparece para o cidadão no portal, explicando o que este assunto resolve."
        error={form.formState.errors.descricao?.message}
        {...form.register("descricao")}
      />

      <SelectField
        label="Setor responsável"
        emptyOption="Seguir o fluxo de atendimento externo"
        options={setores.map((setor) => ({ value: setor.id, label: setor.nome }))}
        error={form.formState.errors.setorId?.message}
        {...form.register("setorId")}
      />

      <InputField
        label="Prazo de resposta (dias)"
        type="number"
        min={1}
        hint="Informativo: aparece no acompanhamento do requerente."
        error={form.formState.errors.prazoDias?.message}
        {...form.register("prazoDias")}
      />

      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
        <input type="checkbox" {...form.register("ativo")} />
        Oferecer este assunto no atendimento
      </label>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : assunto ? "Salvar assunto" : "Criar assunto"}
        </Button>
      </div>
    </form>
  );
};
