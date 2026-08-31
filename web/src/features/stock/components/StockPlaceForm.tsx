"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createStockPlace, renameStockPlace } from "../actions";
import { stockPlaceSchema, type StockPlaceInput } from "../schemas";
import type { StockLocation, Warehouse } from "../types";

/**
 * A escola entrando no cadastro pela porta do almoxarifado.
 *
 * Só o que a identifica: nome, código e de qual almoxarifado ela recebe.
 * Endereço, CNPJ e responsável ficam no outro formulário — são dados de
 * entrega e prestação de contas, e pedi-los todos de uma vez faria o cadastro
 * da primeira escola parecer um cadastro de fornecedor.
 */
export const StockPlaceForm = ({
  place,
  warehouses,
}: {
  place?: StockLocation;
  warehouses: Warehouse[];
}) => {
  const closeModal = useModalClose();
  const isEditing = Boolean(place);

  const { form, onSubmit, isSubmitting } = useResourceForm<StockPlaceInput>({
    schema: stockPlaceSchema,
    defaultValues: {
      nome: place?.nome ?? "",
      codigo: place?.codigo ?? "",
      almoxarifadoId: place?.almoxarifadoId ?? null,
    },
    action: (values) =>
      place ? renameStockPlace(place.id, values) : createStockPlace(values),
    resetOnSuccess: !isEditing,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Escola Municipal Santa Rita"
        error={errors.nome?.message}
        {...form.register("nome")}
      />

      <InputField
        label="Código"
        required
        placeholder="001"
        hint="Curto: é o que se escreve à mão no romaneio. Único na prefeitura."
        error={errors.codigo?.message}
        {...form.register("codigo")}
      />

      {isEditing ? null : (
        <SelectField
          label="Recebe do almoxarifado"
          emptyOption="— definir depois —"
          hint="Sem almoxarifado o local não consegue enviar pedido."
          options={warehouses.map((item) => ({ value: item.id, label: item.nome }))}
          error={errors.almoxarifadoId?.message}
          {...form.register("almoxarifadoId")}
        />
      )}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : isEditing ? "Salvar" : "Cadastrar local"}
        </Button>
      </div>
    </form>
  );
};
