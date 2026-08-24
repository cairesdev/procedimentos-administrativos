"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { templateSchema, type TemplateInput } from "@/features/documents/schemas";
import type { DocumentTemplate, MarkerCatalog } from "@/features/documents/types";
import { saveGlobalTemplate } from "../actions";

/**
 * Edição do modelo padrão do produto. Mesmo formulário da prefeitura, sem
 * "restaurar padrão" — aqui é o padrão, não há para onde voltar.
 */
export const GlobalTemplateForm = ({
  modelo,
  catalogo,
}: {
  modelo: DocumentTemplate;
  catalogo: MarkerCatalog;
}) => {
  const [corpo, setCorpo] = useState(modelo.corpo);

  const { form, onSubmit, isSubmitting } = useResourceForm<TemplateInput>({
    schema: templateSchema as never,
    defaultValues: {
      nome: modelo.nome,
      titulo: modelo.titulo,
      corpo: modelo.corpo,
      ativo: modelo.ativo,
    },
    resetOnSuccess: false,
    action: (values) => saveGlobalTemplate(modelo.tipo, values),
  });

  const copiar = (marcador: string) => {
    void navigator.clipboard.writeText(`{{${marcador}}}`);
    toast.success(`{{${marcador}}} copiado`);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: "18px", alignItems: "start" }}>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
        <Alert tone="info">
          Alterar aqui muda a peça de todas as prefeituras que ainda usam o padrão. Documento já
          emitido não é afetado — cada peça guarda o texto do momento em que saiu.
        </Alert>

        <InputField
          label="Nome no botão de emissão"
          required
          error={form.formState.errors.nome?.message}
          {...form.register("nome")}
        />
        <InputField
          label="Título impresso na peça"
          required
          error={form.formState.errors.titulo?.message}
          {...form.register("titulo")}
        />
        <TextareaField
          label="Corpo"
          required
          rows={20}
          hint="Marcadores entre chaves duplas são trocados na emissão."
          error={form.formState.errors.corpo?.message}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: "12.5px" }}
          {...form.register("corpo", { onChange: (e) => setCorpo(e.target.value) })}
        />

        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
          <input type="checkbox" {...form.register("ativo")} />
          Disponível para emissão
        </label>

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar modelo padrão"}
          </Button>
        </div>
      </form>

      <aside style={{ position: "sticky", top: "16px", display: "grid", gap: "8px" }}>
        <strong style={{ fontSize: "13px" }}>Marcadores deste documento</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {catalogo.valores.map((marcador) => (
            <button
              key={marcador}
              type="button"
              onClick={() => copiar(marcador)}
              style={{
                fontFamily: "ui-monospace, monospace", fontSize: "11px", padding: "3px 6px",
                border: "1px solid var(--borda)", borderRadius: "6px",
                background: "var(--superficie_alt)", cursor: "pointer",
              }}
            >
              {`{{${marcador}}}`}
            </button>
          ))}
        </div>

        {Object.entries(catalogo.listas).map(([lista, campos]) => (
          <div key={lista}>
            <strong style={{ fontSize: "13px" }}>{`{{#${lista}}} … {{/${lista}}}`}</strong>
            <p style={{ fontSize: "11.5px", color: "var(--texto_suave)", margin: "2px 0 6px" }}>
              Repete por item; use {"{{indice}}"} para numerar.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {campos.map((campo) => (
                <button
                  key={campo}
                  type="button"
                  onClick={() => copiar(campo)}
                  style={{
                    fontFamily: "ui-monospace, monospace", fontSize: "11px", padding: "3px 6px",
                    border: "1px solid var(--borda)", borderRadius: "6px",
                    background: "var(--superficie_alt)", cursor: "pointer",
                  }}
                >
                  {`{{${campo}}}`}
                </button>
              ))}
            </div>
          </div>
        ))}

        <strong style={{ fontSize: "13px", marginTop: "6px" }}>Pré-visualização</strong>
        <div
          style={{
            border: "1px dashed var(--borda_forte)", borderRadius: "8px", padding: "10px",
            fontSize: "12px", maxHeight: "300px", overflow: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: corpo }}
        />
      </aside>
    </div>
  );
};
