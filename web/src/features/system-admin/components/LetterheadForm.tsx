"use client";

import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { saveLetterhead } from "../actions";
import { letterheadSchema, type LetterheadInput } from "../schemas";
import type { Letterhead, Tenant } from "../types";

export const LetterheadForm = ({
  tenant,
  letterhead,
}: {
  tenant: Tenant;
  letterhead: Letterhead;
}) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<LetterheadInput>({
    schema: letterheadSchema as never,
    defaultValues: {
      arquivoLogomarca: letterhead.arquivoLogomarca ?? "",
      cabecalhoTimbre: letterhead.cabecalhoTimbre ?? "",
      rodapeTimbre: letterhead.rodapeTimbre ?? "",
    },
    action: (values) => saveLetterhead(tenant.id, values),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Usado nos comprovantes, declarações e relatórios emitidos pela prefeitura.
      </Alert>

      <TextareaField
        label="Cabeçalho"
        placeholder="PREFEITURA MUNICIPAL DE… — ESTADO DO MARANHÃO"
        {...form.register("cabecalhoTimbre")}
      />
      <TextareaField
        label="Rodapé"
        placeholder="Praça Central, s/n — CEP 65400-000"
        {...form.register("rodapeTimbre")}
      />
      <InputField
        label="Logomarca"
        placeholder="brasao.png"
        hint="Nome do arquivo no storage; o upload entra numa próxima etapa."
        {...form.register("arquivoLogomarca")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar timbre"}
        </Button>
      </div>
    </form>
  );
};
