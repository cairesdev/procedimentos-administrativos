"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import {
  Alert,
  Card,
  FieldGrid,
  Steps,
  SummaryGrid,
  Table,
  numericCell,
} from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Supplier } from "@/features/suppliers/types";
import { createAssetIntake } from "../actions";
import { assetIntakeSchema, type AssetIntakeInput } from "../schemas";
import type { AssetCategory, AssetLocation } from "../types";
import { QuickCategoryForm } from "./QuickCategoryForm";
import styles from "./AssetIntakeWizard.module.css";

const STEPS = ["Origem", "Lotes", "Revisão"];

const emptyBatch = {
  categoriaId: "",
  localDestinoId: "",
  nomeBem: "",
  quantidade: 1,
};

// Uma entrada tomba vários bens de uma vez: cada lote vira N bens numerados
// em sequência dentro do local de destino.
export const AssetIntakeWizard = ({
  locations,
  categories,
  suppliers,
}: {
  locations: AssetLocation[];
  categories: AssetCategory[];
  suppliers: Supplier[];
}) => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  // Categorias criadas sem sair daqui, somadas às que vieram do servidor.
  const [newCategories, setNewCategories] = useState<AssetCategory[]>([]);
  const [categoryFor, setCategoryFor] = useState<number | null>(null);

  const { form, onSubmit, isSubmitting } = useResourceForm<AssetIntakeInput>({
    schema: assetIntakeSchema as never,
    defaultValues: {
      data: new Date().toISOString().slice(0, 10),
      fornecedorId: "",
      notaFiscal: "",
      lotes: [emptyBatch],
    },
    action: createAssetIntake,
    redirectTo: "/patrimonio/entradas",
    resetOnSuccess: false,
  });

  const batches = useFieldArray({ control: form.control, name: "lotes" });
  const { errors } = form.formState;
  const values = form.watch();

  const activeLocations = locations.filter((location) => location.ativo);
  const activeCategories = [
    ...categories.filter((category) => category.ativo),
    ...newCategories,
  ];

  const useNewCategory = (category: AssetCategory) => {
    setNewCategories((current) => [...current, category]);
    if (categoryFor !== null) {
      form.setValue(`lotes.${categoryFor}.categoriaId`, category.id, {
        shouldValidate: true,
      });
    }
    setCategoryFor(null);
  };

  const total = (values.lotes ?? []).reduce(
    (sum, batch) => sum + (Number(batch?.quantidade) || 0),
    0,
  );

  const goNext = async () => {
    const fields: Record<number, (keyof AssetIntakeInput)[]> = {
      0: ["data", "fornecedorId", "notaFiscal"],
      1: ["lotes"],
    };
    const valid = await form.trigger(fields[step] as never);
    if (!valid) {
      toast.error("Revise os campos destacados antes de continuar");
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  return (
    <>
      <form onSubmit={onSubmit}>
        <Steps steps={STEPS} current={step} />

        {step === 0 ? (
          <Card title="De onde vieram os bens?">
            <FieldGrid>
              <InputField
                label="Data da entrada"
                type="date"
                required
                error={errors.data?.message}
                {...form.register("data")}
              />
              <SelectField
                label="Fornecedor"
                emptyOption="Não informado"
                options={suppliers.map((supplier) => ({
                  value: supplier.id,
                  label: supplier.razaoSocial,
                }))}
                error={errors.fornecedorId?.message}
                {...form.register("fornecedorId")}
              />
              <InputField
                label="Nota fiscal"
                placeholder="12345"
                error={errors.notaFiscal?.message}
                {...form.register("notaFiscal")}
              />
            </FieldGrid>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card title="Lotes recebidos">
            <div className={styles.batches}>
              {batches.fields.map((field, index) => {
                const batch = values.lotes?.[index];
                const location = activeLocations.find(
                  (item) => item.id === batch?.localDestinoId,
                );

                return (
                  <div key={field.id}>
                    <div className={styles.batch}>
                      <div className={styles.category}>
                        <SelectField
                          label="Categoria"
                          required
                          emptyOption="Selecione"
                          options={activeCategories.map((category) => ({
                            value: category.id,
                            label: category.nome,
                          }))}
                          error={errors.lotes?.[index]?.categoriaId?.message}
                          {...form.register(`lotes.${index}.categoriaId`)}
                        />
                        <button
                          type="button"
                          className={styles.category_add}
                          onClick={() => setCategoryFor(index)}
                          title="Cadastrar categoria nova"
                          aria-label="Cadastrar categoria nova"
                        >
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <SelectField
                        label="Local de destino"
                        required
                        emptyOption="Selecione"
                        options={activeLocations.map((item) => ({
                          value: item.id,
                          label: `${item.codigo} · ${item.nome}`,
                        }))}
                        error={errors.lotes?.[index]?.localDestinoId?.message}
                        {...form.register(`lotes.${index}.localDestinoId`)}
                      />
                      <InputField
                        label="Bem"
                        required
                        placeholder="Cadeira giratória"
                        error={errors.lotes?.[index]?.nomeBem?.message}
                        {...form.register(`lotes.${index}.nomeBem`)}
                      />
                      <InputField
                        label="Qtd."
                        type="number"
                        min={1}
                        required
                        error={errors.lotes?.[index]?.quantidade?.message}
                        {...form.register(`lotes.${index}.quantidade`)}
                      />
                      <button
                        type="button"
                        className={styles.batch_remove}
                        onClick={() => batches.remove(index)}
                        disabled={batches.fields.length === 1}
                        aria-label="Remover lote"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>

                    {location && Number(batch?.quantidade) > 0 ? (
                      <p className={styles.preview}>
                        Gera {batch!.quantidade} tombamento(s) sequenciais com
                        prefixo <strong>{location.codigo}-</strong>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {errors.lotes?.message ? (
              <Alert tone="error">{errors.lotes.message}</Alert>
            ) : null}

            <div style={{ marginTop: "12px" }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => batches.append(emptyBatch)}
              >
                <Plus
                  size={15}
                  aria-hidden="true"
                  style={{ verticalAlign: "-2px", marginRight: "6px" }}
                />
                Adicionar lote
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card title="Revisão">
            <div style={{ display: "grid", gap: "14px" }}>
              <Alert tone="info">
                Ao confirmar, os tombamentos são gerados em sequência dentro de
                cada local e não podem ser desfeitos.
              </Alert>

              <SummaryGrid
                items={[
                  { label: "Data", value: values.data || "—" },
                  {
                    label: "Fornecedor",
                    value:
                      suppliers.find(
                        (supplier) => supplier.id === values.fornecedorId,
                      )?.razaoSocial ?? "Não informado",
                  },
                  { label: "Nota fiscal", value: values.notaFiscal || "—" },
                  { label: "Bens a tombar", value: total },
                ]}
              />

              <Table
                columns={["Bem", "Categoria", "Local", "Qtd."]}
                isEmpty={(values.lotes ?? []).length === 0}
                emptyMessage="Nenhum lote informado."
              >
                {(values.lotes ?? []).map((batch, index) => (
                  <tr key={index}>
                    <td>{batch.nomeBem}</td>
                    <td>
                      {activeCategories.find(
                        (category) => category.id === batch.categoriaId,
                      )?.nome ?? "—"}
                    </td>
                    <td>
                      {activeLocations.find(
                        (item) => item.id === batch.localDestinoId,
                      )?.nome ?? "—"}
                    </td>
                    <td className={numericCell}>{batch.quantidade}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </Card>
        ) : null}

        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              step === 0
                ? router.push("/patrimonio/entradas")
                : setStep(step - 1)
            }
          >
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Tombando…" : `Tombar ${total} bem(ns)`}
            </Button>
          )}
        </div>
      </form>

      {/* Fora do <form> do assistente: form aninhado é HTML inválido. */}
      <Modal
        open={categoryFor !== null}
        onClose={() => setCategoryFor(null)}
        title="Nova categoria"
        description="Fica cadastrada para a prefeitura e já entra neste lote."
      >
        <QuickCategoryForm onCreated={useNewCategory} />
      </Modal>
    </>
  );
};
