"use client";

import { InputField, SelectField } from "@/shared/ui/form-field";
import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createConsumptionReport } from "../actions";
import { consumptionReportSchema, type ConsumptionReportInput } from "../schemas";
import type { StockType, Warehouse } from "../types";

/** O primeiro dia do mês passado até o último — o recorte que a prestação usa. */
const mesPassado = () => {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  const iso = (data: Date) => data.toISOString().slice(0, 10);
  return { inicio: iso(inicio), fim: iso(fim) };
};

export const ConsumptionReportForm = ({
  almoxarifados,
  tipos,
}: {
  almoxarifados: Warehouse[];
  tipos: StockType[];
}) => {
  const closeModal = useModalClose();
  const padrao = mesPassado();

  const { form, onSubmit, isSubmitting } = useResourceForm<ConsumptionReportInput>({
    schema: consumptionReportSchema as never,
    defaultValues: {
      almoxarifadoId: almoxarifados[0]?.id ?? "",
      tipoEstoqueId: "",
      periodoInicio: padrao.inicio,
      periodoFim: padrao.fim,
    },
    action: createConsumptionReport,
    resetOnSuccess: false,
    onDone: closeModal,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        O recorte fica salvo e os números são apurados toda vez que você abre. Emitir o documento
        congela o resultado daquele momento.
      </Alert>

      <SelectField
        label="Almoxarifado"
        required
        options={almoxarifados.map((item) => ({ value: item.id, label: item.nome }))}
        {...form.register("almoxarifadoId")}
      />

      <SelectField
        label="Tipo de estoque"
        emptyOption="Todos os tipos"
        hint="A alimentação escolar costuma ser um tipo só."
        options={tipos.map((item) => ({ value: item.id, label: item.nome }))}
        {...form.register("tipoEstoqueId")}
      />

      <InputField label="Início do período" type="date" required {...form.register("periodoInicio")} />
      <InputField label="Fim do período" type="date" required {...form.register("periodoFim")} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Gerando…" : "Gerar relatório"}
      </Button>
    </form>
  );
};
