"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import styles from "./Checklist.module.css";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createChecklist } from "../actions";
import { checklistSchema, type ChecklistInput } from "../schemas";
import { ALVOS, type ChecklistTemplate } from "../types";

const ITEM_VAZIO = {
  titulo: "",
  descricao: "",
  exigeAnexo: false,
  recorrente: false,
  periodicidadeDias: null,
  prazoLimite: "",
  responsavel: "",
};

/**
 * Uma lista nova: de um modelo, ou escrita na hora.
 *
 * Escolhido o modelo, os itens somem do formulário — eles serão **copiados**
 * dele na API. Mostrá-los aqui sugeriria que dá para editar antes de aplicar,
 * e a cópia acontece do outro lado.
 */
export const ChecklistForm = ({
  modelos,
  setores,
  alvo,
}: {
  modelos: ChecklistTemplate[];
  setores: { id: string; nome: string }[];
  /** Quando a tela já sabe a que o checklist se prende — o card do processo. */
  alvo?: { tipo: string; id: string };
}) => {
  const closeModal = useModalClose();
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);

  const { form, onSubmit, isSubmitting } = useResourceForm<ChecklistInput>({
    schema: checklistSchema,
    defaultValues: {
      titulo: "",
      descricao: "",
      modeloId: "",
      alvoTipo: alvo?.tipo as ChecklistInput["alvoTipo"],
      alvoId: alvo?.id ?? "",
      responsavel: "",
    },
    action: (values) => createChecklist({
      ...values,
      // Com modelo, os itens vêm de lá; sem ele, do formulário.
      itens: values.modeloId ? undefined : itens,
    }),
    onDone: closeModal,
  });

  const { errors } = form.formState;
  const modeloEscolhido = form.watch("modeloId");

  const destinos = [
    ...setores.map((setor) => ({ value: `setor:${setor.id}`, label: `Setor · ${setor.nome}` })),
    { value: "fornecedor", label: "Fornecedor (externo)" },
  ];

  const mudarItem = (indice: number, campo: string, valor: unknown) => {
    setItens((atuais) => atuais.map((item, i) =>
      i === indice ? { ...item, [campo]: valor } : item));
  };

  return (
    <form onSubmit={onSubmit} className={styles.formulario}>
      {modelos.length > 0 ? (
        <SelectField
          label="Modelo"
          emptyOption="— escrever na hora —"
          hint="Os itens do modelo são copiados. Mudar o modelo depois não mexe nesta lista."
          options={modelos.map((modelo) => ({ value: modelo.id, label: modelo.nome }))}
          {...form.register("modeloId")}
        />
      ) : null}

      <InputField
        label="Título"
        required={!modeloEscolhido}
        placeholder="Habilitação do fornecedor"
        hint={modeloEscolhido ? "Em branco: usa o nome do modelo." : undefined}
        error={errors.titulo?.message}
        {...form.register("titulo")}
      />

      {alvo ? null : (
        <FieldGrid>
          <SelectField
            label="Referente a"
            emptyOption="— lista avulsa —"
            hint="Um processo, contrato, fornecedor… ou nada."
            options={ALVOS.map((tipo) => ({ value: tipo, label: tipo.toLowerCase() }))}
            {...form.register("alvoTipo")}
          />
          <InputField
            label="Id do registro"
            placeholder="Cole o identificador"
            hint="Só quando houver um registro."
            {...form.register("alvoId")}
          />
        </FieldGrid>
      )}

      <SelectField
        label="Responsável geral"
        emptyOption="— sem responsável —"
        options={destinos.filter((destino) => destino.value !== "fornecedor")}
        {...form.register("responsavel")}
      />

      {modeloEscolhido ? (
        <Alert tone="info">
          Os itens virão do modelo escolhido, com os prazos contados a partir de hoje.
        </Alert>
      ) : (
        <div className={styles.lista}>
          <strong className={styles.secao_titulo}>Itens</strong>

          {itens.map((item, indice) => (
            <div
              key={indice}
            className={styles.item}
            >
              <InputField
                label={`Item ${indice + 1}`}
                name={`item-${indice}`}
                required
                placeholder="Certidão negativa de débitos"
                value={item.titulo}
                onChange={(evento) => mudarItem(indice, "titulo", evento.target.value)}
              />

              <FieldGrid>
                <SelectField
                  label="Quem cumpre"
                  name={`responsavel-${indice}`}
                  emptyOption="— definir depois —"
                  options={destinos}
                  value={item.responsavel}
                  onChange={(evento) => mudarItem(indice, "responsavel", evento.target.value)}
                />
                <InputField
                  label="Prazo"
                  name={`prazo-${indice}`}
                  type="date"
                  value={item.prazoLimite}
                  onChange={(evento) => mudarItem(indice, "prazoLimite", evento.target.value)}
                />
              </FieldGrid>

              <div className={styles.opcoes}>
                <label className={styles.opcao}>
                  <input
                    type="checkbox"
                    checked={item.exigeAnexo}
                    onChange={(evento) => mudarItem(indice, "exigeAnexo", evento.target.checked)}
                  />
                  Exige documento anexado
                </label>

                <label className={styles.opcao}>
                  <input
                    type="checkbox"
                    checked={item.recorrente}
                    onChange={(evento) => mudarItem(indice, "recorrente", evento.target.checked)}
                  />
                  Vence e precisa ser cumprido de novo
                </label>

                {/* Só aparece quando é recorrente: periodicidade sem
                    recorrência é número que ninguém lê, e o banco recusa. */}
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

              <TextareaField
                label="Detalhe"
                name={`descricao-${indice}`}
                rows={2}
                value={item.descricao}
                onChange={(evento) => mudarItem(indice, "descricao", evento.target.value)}
              />
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
      )}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando…" : "Criar checklist"}
        </Button>
      </div>
    </form>
  );
};
