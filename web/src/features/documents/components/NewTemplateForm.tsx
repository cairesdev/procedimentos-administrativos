"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createTemplate } from "../actions";
import { newTemplateSchema, type NewTemplateInput } from "../schemas";
import type { DocumentScope, ScopeOption } from "../types";

/**
 * Peça nova, inventada pela prefeitura.
 *
 * O escopo é a única decisão que não dá para desfazer depois: ele determina de
 * onde a peça fala e, portanto, quais marcadores existem. Por isso a lista de
 * marcadores muda junto com a escolha, antes de escrever qualquer coisa.
 */
export const NewTemplateForm = ({ escopos }: { escopos: ScopeOption[] }) => {
  const [escopo, setEscopo] = useState<DocumentScope>(escopos[0]?.escopo ?? "PROCESSO");
  const catalogo = escopos.find((opcao) => opcao.escopo === escopo)?.marcadores;

  const { form, onSubmit, isSubmitting } = useResourceForm<NewTemplateInput>({
    schema: newTemplateSchema as never,
    defaultValues: {
      nome: "",
      titulo: "",
      corpo: "<p>Escreva aqui o texto da peça, usando os marcadores ao lado.</p>",
      ativo: true,
      escopo: escopos[0]?.escopo ?? "PROCESSO",
    },
    resetOnSuccess: false,
    // Sucesso leva direto para a edição da peça criada.
    action: (values) => createTemplate(values),
  });

  return (
    <div style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        A peça criada aqui vale só para esta prefeitura e aparece no botão de emissão da tela
        correspondente ao escopo escolhido.
      </Alert>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
        <InputField
          label="Nome do documento"
          required
          placeholder="Ex.: Termo de recebimento definitivo"
          hint="Aparece no botão de emissão. O identificador interno sai daqui."
          error={form.formState.errors.nome?.message}
          {...form.register("nome")}
        />

        <InputField
          label="Título impresso"
          required
          placeholder="Ex.: TERMO DE RECEBIMENTO DEFINITIVO"
          error={form.formState.errors.titulo?.message}
          {...form.register("titulo")}
        />

        <SelectField
          label="De onde a peça fala"
          required
          options={escopos.map((opcao) => ({ value: opcao.escopo, label: opcao.rotulo }))}
          hint="Define quais dados o documento consegue citar. Não muda depois."
          error={form.formState.errors.escopo?.message}
          {...form.register("escopo", {
            onChange: (evento) => setEscopo(evento.target.value as DocumentScope),
          })}
        />

        <TextareaField
          label="Corpo"
          required
          rows={12}
          hint="Aceita parágrafos e tabelas. Marcadores entre chaves duplas são trocados na emissão."
          style={{ fontFamily: "ui-monospace, monospace", fontSize: "12.5px" }}
          error={form.formState.errors.corpo?.message}
          {...form.register("corpo")}
        />

        {catalogo ? (
          <div>
            <p style={{ fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
              Marcadores deste escopo
            </p>
            <p style={{ fontSize: "11.5px", color: "var(--texto_suave)", lineHeight: 1.6 }}>
              {catalogo.valores.map((marcador) => `{{${marcador}}}`).join("  ")}
            </p>
            {Object.entries(catalogo.listas).map(([lista, campos]) => (
              <p key={lista} style={{ fontSize: "11.5px", color: "var(--texto_suave)", marginTop: "6px" }}>
                {`{{#${lista}}}`} … {`{{/${lista}}}`} repete por item:{" "}
                {campos.map((campo) => `{{${campo}}}`).join("  ")}
              </p>
            ))}
          </div>
        ) : null}

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Criando…" : "Criar documento"}
          </Button>
        </div>
      </form>
    </div>
  );
};
