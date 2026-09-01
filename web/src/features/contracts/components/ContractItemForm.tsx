"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { updateContractItem } from "../actions";
import { contractItemEditSchema, type ContractItemEditInput } from "../schemas";
import { MEASUREMENT_MODES, type ContractItem } from "../types";

const quantidade = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Corrigir um item do contrato.
 *
 * Os itens entram por colagem de planilha, e erro de digitação em preço só
 * aparece quando alguém vai pedir o material. Antes disto, a única saída era
 * refazer o contrato inteiro.
 */
export const ContractItemForm = ({
  contractId,
  item,
}: {
  contractId: string;
  item: ContractItem;
}) => {
  const closeModal = useModalClose();

  // O que já saiu em solicitação: é o piso da quantidade, e o motivo de a
  // tela mostrar o número antes de o usuário errar.
  const consumido = item.quantidadeTotal - item.saldoDisponivel;

  const { form, onSubmit, isSubmitting } = useResourceForm<ContractItemEditInput>({
    schema: contractItemEditSchema,
    defaultValues: {
      produto: item.produto,
      descricao: item.descricao ?? "",
      unidadeMedida: item.unidadeMedida,
      marca: item.marca ?? "",
      quantidadeTotal: item.quantidadeTotal,
      modoMedicao: item.modoMedicao as ContractItemEditInput["modoMedicao"],
      valorUnitario: item.valorUnitario,
      valorTotal: item.valorTotal,
    },
    action: (values) => updateContractItem(contractId, item.id, values),
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      {consumido > 0 ? (
        <Alert tone="info">
          Já saíram {quantidade(consumido)} {item.unidadeMedida} deste item em solicitações.
          A quantidade não pode ficar abaixo disso.
        </Alert>
      ) : null}

      <InputField
        label="Produto"
        required
        error={errors.produto?.message}
        {...form.register("produto")}
      />

      <TextareaField
        label="Descrição"
        rows={2}
        error={errors.descricao?.message}
        {...form.register("descricao")}
      />

      <FieldGrid>
        <InputField
          label="Unidade de medida"
          required
          placeholder="KG, UN, CX"
          error={errors.unidadeMedida?.message}
          {...form.register("unidadeMedida")}
        />
        <InputField label="Marca" error={errors.marca?.message} {...form.register("marca")} />
      </FieldGrid>

      <FieldGrid>
        <InputField
          label="Quantidade"
          type="number"
          step="0.001"
          required
          hint={consumido > 0 ? `Mínimo: ${quantidade(consumido)}` : undefined}
          error={errors.quantidadeTotal?.message}
          {...form.register("quantidadeTotal")}
        />
        <SelectField
          label="Medição"
          required
          options={MEASUREMENT_MODES.map((modo) => ({ value: modo, label: humanize(modo) }))}
          error={errors.modoMedicao?.message}
          {...form.register("modoMedicao")}
        />
      </FieldGrid>

      <FieldGrid>
        <InputField
          label="Valor unitário"
          type="number"
          step="0.0001"
          required
          error={errors.valorUnitario?.message}
          {...form.register("valorUnitario")}
        />
        <InputField
          label="Valor total do item"
          type="number"
          step="0.01"
          required
          error={errors.valorTotal?.message}
          {...form.register("valorTotal")}
        />
      </FieldGrid>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar item"}
        </Button>
      </div>
    </form>
  );
};
