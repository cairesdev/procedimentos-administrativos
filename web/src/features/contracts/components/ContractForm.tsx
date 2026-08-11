"use client";

import { useFieldArray } from "react-hook-form";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Bid } from "@/features/bids/types";
import type { Supplier } from "@/features/suppliers/types";
import type { Unit } from "@/features/units/types";
import { createContract } from "../actions";
import { contractSchema, type ContractInput } from "../schemas";
import { MEASUREMENT_MODES } from "../types";
import styles from "./ContractForm.module.css";

const emptyItem = {
  produto: "",
  descricao: "",
  unidadeMedida: "",
  marca: "",
  quantidadeTotal: 0,
  modoMedicao: "UNIDADE" as const,
  valorUnitario: 0,
  valorTotal: 0,
};

export const ContractForm = ({
  units,
  suppliers,
  bids,
}: {
  units: Unit[];
  suppliers: Supplier[];
  bids: Bid[];
}) => {
  const { form, onSubmit, result, isSubmitting } = useResourceForm<ContractInput>({
    schema: contractSchema as never,
    defaultValues: {
      numero: "",
      fornecedorId: "",
      licitacaoId: "",
      dataInicio: "",
      dataFim: "",
      valorTotal: 0,
      fiscalNomeMatricula: "",
      unidadesDestinadas: [],
      itens: [emptyItem],
    },
    action: createContract,
  });

  const { errors } = form.formState;
  const items = useFieldArray({ control: form.control, name: "itens" });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "16px" }}>
      <Alert tone="info">
        O contrato gera automaticamente número de protocolo e de processo administrativo.
      </Alert>

      <FieldGrid>
        <InputField
          label="Número/ano"
          required
          placeholder="CT-047/2026"
          error={errors.numero?.message}
          {...form.register("numero")}
        />
        <SelectField
          label="Fornecedor"
          required
          emptyOption="Selecione"
          options={suppliers.map((supplier) => ({
            value: supplier.id,
            label: supplier.razaoSocial,
          }))}
          error={errors.fornecedorId?.message}
          {...form.register("fornecedorId")}
        />
        <SelectField
          label="Licitação de origem"
          required
          emptyOption="Selecione"
          options={bids.map((bid) => ({ value: bid.id, label: `${bid.numero} — ${bid.objeto.slice(0, 40)}` }))}
          error={errors.licitacaoId?.message}
          {...form.register("licitacaoId")}
        />
        <InputField
          label="Fiscal do contrato"
          placeholder="Maria Fiscal — mat. 1234"
          error={errors.fiscalNomeMatricula?.message}
          {...form.register("fiscalNomeMatricula")}
        />
        <InputField
          label="Início da vigência"
          type="date"
          required
          error={errors.dataInicio?.message}
          {...form.register("dataInicio")}
        />
        <InputField
          label="Fim da vigência"
          type="date"
          required
          error={errors.dataFim?.message}
          {...form.register("dataFim")}
        />
        <InputField
          label="Valor total"
          type="number"
          step="0.01"
          required
          error={errors.valorTotal?.message}
          {...form.register("valorTotal")}
        />
      </FieldGrid>

      <SelectField
        label="Unidades destinadas"
        required
        multiple
        options={units.map((unit) => ({ value: unit.id, label: unit.nome }))}
        hint="Só estas unidades podem solicitar itens deste contrato."
        error={errors.unidadesDestinadas?.message}
        {...form.register("unidadesDestinadas")}
      />

      <div className={styles.items}>
        <div className={styles.items_header}>
          <span>Itens do contrato</span>
          <Button type="button" variant="secondary" onClick={() => items.append(emptyItem)}>
            Adicionar item
          </Button>
        </div>

        {items.fields.map((field, index) => (
          <div key={field.id} className={styles.item}>
            <FieldGrid>
              <InputField
                label="Produto"
                required
                error={errors.itens?.[index]?.produto?.message}
                {...form.register(`itens.${index}.produto`)}
              />
              <InputField
                label="Unidade de medida"
                required
                placeholder="KG, UN, LITRO"
                error={errors.itens?.[index]?.unidadeMedida?.message}
                {...form.register(`itens.${index}.unidadeMedida`)}
              />
              <InputField label="Marca" {...form.register(`itens.${index}.marca`)} />
              <SelectField
                label="Modo de medição"
                required
                options={MEASUREMENT_MODES.map((mode) => ({ value: mode, label: humanize(mode) }))}
                {...form.register(`itens.${index}.modoMedicao`)}
              />
              <InputField
                label="Quantidade"
                type="number"
                step="0.001"
                required
                error={errors.itens?.[index]?.quantidadeTotal?.message}
                {...form.register(`itens.${index}.quantidadeTotal`)}
              />
              <InputField
                label="Valor unitário"
                type="number"
                step="0.0001"
                {...form.register(`itens.${index}.valorUnitario`)}
              />
              <InputField
                label="Valor total do item"
                type="number"
                step="0.01"
                required
                error={errors.itens?.[index]?.valorTotal?.message}
                {...form.register(`itens.${index}.valorTotal`)}
              />
            </FieldGrid>

            {items.fields.length > 1 ? (
              <button
                type="button"
                className={styles.remove}
                onClick={() => items.remove(index)}
              >
                Remover item
              </button>
            ) : null}
          </div>
        ))}

        {errors.itens?.message ? <Alert tone="error">{errors.itens.message}</Alert> : null}
      </div>

      {result.error ? <Alert tone="error">{result.error}</Alert> : null}
      {result.success ? <Alert tone="success">{result.success}</Alert> : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Cadastrar contrato"}
        </Button>
      </div>
    </form>
  );
};
