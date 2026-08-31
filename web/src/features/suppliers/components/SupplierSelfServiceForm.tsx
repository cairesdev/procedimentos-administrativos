"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { saveSupplierSelfService } from "../actions";
import { supplierSelfServiceSchema, type SupplierSelfServiceInput } from "../schemas";
import type { SupplierInvitePage } from "../types";

export const SupplierSelfServiceForm = ({
  token,
  dados,
}: {
  token: string;
  dados: SupplierInvitePage;
}) => {
  const [salvo, setSalvo] = useState(false);

  const { form, onSubmit, isSubmitting } = useResourceForm<SupplierSelfServiceInput>({
    schema: supplierSelfServiceSchema as never,
    defaultValues: {
      razaoSocial: dados.razaoSocial,
      endereco: dados.endereco ?? "",
      email: dados.email ?? "",
      telefone: dados.telefone ?? "",
      inscricaoEstadual: dados.inscricaoEstadual ?? "",
      inscricaoMunicipal: dados.inscricaoMunicipal ?? "",
    },
    action: (values) => saveSupplierSelfService(token, values),
    resetOnSuccess: false,
    onDone: () => {
      setSalvo(true);
      toast.success("Cadastro atualizado. Obrigado!");
    },
  });

  if (salvo) {
    return (
      <Alert tone="success">
        <strong>Pronto.</strong> Seus dados foram atualizados e já estão com a prefeitura. O link
        continua valendo até a data indicada, caso precise corrigir algo.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField label="Razão social" required {...form.register("razaoSocial")} />
      <TextareaField
        label="Endereço"
        placeholder="Rua, número, bairro, cidade e CEP"
        {...form.register("endereco")}
      />
      <InputField label="E-mail" type="email" {...form.register("email")} />
      <InputField label="Telefone" {...form.register("telefone")} />
      <InputField label="Inscrição estadual" {...form.register("inscricaoEstadual")} />
      <InputField label="Inscrição municipal" {...form.register("inscricaoMunicipal")} />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enviando…" : "Confirmar meus dados"}
        </Button>
      </div>
    </form>
  );
};
