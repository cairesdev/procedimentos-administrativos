"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createTemplate, updateTemplate } from "../actions";
import { templateSchema, type TemplateInput } from "../schemas";
import type { ChecklistTemplateDetail } from "../types";

const ITEM_VAZIO = {
  titulo: "",
  descricao: "",
  exigeAnexo: false,
  recorrente: false,
  periodicidadeDias: null as number | null,
  prazoDias: null as number | null,
  responsavel: "",
};

const destinoDoItem = (item: {
  setorId: string | null; departamentoId: string | null; paraFornecedor: boolean;
}) => {
  if (item.paraFornecedor) return "fornecedor";
  if (item.setorId) return `setor:${item.setorId}`;
  if (item.departamentoId) return `departamento:${item.departamentoId}`;
  return "";
};

/**
 * O modelo: a lista escrita uma vez.
 *
 * O prazo aqui é em **dias**, e não data: uma data fixa envelheceria junto com
 * o modelo, e um modelo de dois anos atrás nasceria vencido.
 */
export const TemplateForm = ({
  modelo,
  setores,
}: {
  modelo?: ChecklistTemplateDetail;
  setores: { id: string; nome: string }[];
}) => {
  const closeModal = useModalClose();
  const [itens, setItens] = useState(
    modelo?.itens.map((item) => ({
      titulo: item.titulo,
      descricao: item.descricao ?? "",
      exigeAnexo: item.exigeAnexo,
      recorrente: item.recorrente,
      periodicidadeDias: item.periodicidadeDias,
      prazoDias: item.prazoDias,
      responsavel: destinoDoItem(item),
    })) ?? [{ ...ITEM_VAZIO }],
  );

  const { form, onSubmit, isSubmitting } = useResourceForm<TemplateInput>({
    schema: templateSchema,
    defaultValues: {
      nome: modelo?.nome ?? "",
      descricao: modelo?.descricao ?? "",
      ativo: modelo?.ativo ?? true,
      itens: [],
    },
    action: (values) => (modelo
      ? updateTemplate(modelo.id, { ...values, itens })
      : createTemplate({ ...values, itens })),
    resetOnSuccess: !modelo,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  const destinos = [
    ...setores.map((setor) => ({ value: `setor:${setor.id}`, label: `Setor · ${setor.nome}` })),
    { value: "fornecedor", label: "Fornecedor (externo)" },
  ];

  const mudarItem = (indice: number, campo: string, valor: unknown) => {
    setItens((atuais) => atuais.map((item, i) =>
      i === indice ? { ...item, [campo]: valor } : item));
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Habilitação de fornecedor"
        error={errors.nome?.message}
        {...form.register("nome")}
      />

      <TextareaField
        label="Descrição"
        rows={2}
        {...form.register("descricao")}
      />

      <div style={{ display: "grid", gap: "10px" }}>
        <strong style={{ fontSize: "0.9rem" }}>Itens</strong>

        {itens.map((item, indice) => (
          <div
            key={indice}
            style={{
              border: "1px solid var(--borda)", borderRadius: "8px",
              padding: "12px", display: "grid", gap: "10px",
            }}
          >
            <InputField
              label={`Item ${indice + 1}`}
              name={`titulo-${indice}`}
              required
              placeholder="Certidão negativa de débitos federais"
              value={item.titulo}
              onChange={(evento) => mudarItem(indice, "titulo", evento.target.value)}
            />

            <FieldGrid>
              <SelectField
                label="Quem cumpre"
                name={`destino-${indice}`}
                emptyOption="— definir na aplicação —"
                options={destinos}
                value={item.responsavel}
                onChange={(evento) => mudarItem(indice, "responsavel", evento.target.value)}
              />
              <InputField
                label="Prazo (dias)"
                name={`prazo-${indice}`}
                type="number"
                min="1"
                hint="Contados a partir da aplicação."
                value={item.prazoDias ?? ""}
                onChange={(evento) => mudarItem(
                  indice, "prazoDias", Number(evento.target.value) || null,
                )}
              />
            </FieldGrid>

            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: "13px", display: "flex", gap: "6px" }}>
                <input
                  type="checkbox"
                  checked={item.exigeAnexo}
                  onChange={(evento) => mudarItem(indice, "exigeAnexo", evento.target.checked)}
                />
                Exige documento
              </label>

              <label style={{ fontSize: "13px", display: "flex", gap: "6px" }}>
                <input
                  type="checkbox"
                  checked={item.recorrente}
                  onChange={(evento) => mudarItem(indice, "recorrente", evento.target.checked)}
                />
                Vence e volta a ser exigível
              </label>

              {item.recorrente ? (
                <InputField
                  label="A cada (dias)"
                  name={`periodicidade-${indice}`}
                  type="number"
                  min="1"
                  required
                  value={item.periodicidadeDias ?? ""}
                  onChange={(evento) => mudarItem(
                    indice, "periodicidadeDias", Number(evento.target.value) || null,
                  )}
                />
              ) : null}

              {itens.length > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setItens((atuais) => atuais.filter((_, i) => i !== indice))}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          onClick={() => setItens((atuais) => [...atuais, { ...ITEM_VAZIO }])}
        >
          <Plus size={14} aria-hidden="true" style={{ marginRight: "6px" }} />
          Mais um item
        </Button>
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : modelo ? "Salvar modelo" : "Criar modelo"}
        </Button>
      </div>
    </form>
  );
};
