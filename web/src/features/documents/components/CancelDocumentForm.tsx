"use client";

import { Button } from "@/shared/ui/button";
import { TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { cancelDocument } from "../actions";
import { cancelDocumentSchema, type CancelDocumentInput } from "../schemas";

export const CancelDocumentForm = ({ documentId }: { documentId: string }) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<CancelDocumentInput>({
    schema: cancelDocumentSchema as never,
    defaultValues: { motivo: "" },
    action: (values) => cancelDocument(documentId, values),
    onDone: closeModal,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        O documento não é apagado: continua conferível pelo código, marcado como sem efeito. Papel
        já entregue não pode ficar sem contraparte no sistema.
      </Alert>

      <TextareaField
        label="Motivo do cancelamento"
        required
        placeholder="Ex.: valor divergente da nota fiscal"
        error={form.formState.errors.motivo?.message}
        {...form.register("motivo")}
      />

      <div>
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? "Cancelando…" : "Cancelar documento"}
        </Button>
      </div>
    </form>
  );
};
