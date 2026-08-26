"use client";

import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { saveStockLocation } from "../actions";
import { stockLocationSchema, type StockLocationInput } from "../schemas";
import type { StockLocation, Warehouse } from "../types";

/**
 * O local é o mesmo cadastro do patrimônio — o prédio guarda bem tombado e
 * mantimento. Aqui se completa o que o estoque precisa: a qual almoxarifado ele
 * pertence, para onde entregar e quem recebe.
 */
export const StockLocationForm = ({
  location,
  warehouses,
}: {
  location: StockLocation;
  warehouses: Warehouse[];
}) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<StockLocationInput>({
    schema: stockLocationSchema,
    defaultValues: {
      almoxarifadoId: location.almoxarifadoId,
      cnpj: location.cnpj ?? "",
      endereco: location.endereco ?? "",
      responsavel: location.responsavel ?? "",
      bairro: "",
      municipio: "",
      uf: "",
      cep: "",
      telefone: "",
      email: "",
    },
    action: (values) => saveStockLocation(location.id, values),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <SelectField
        label="Almoxarifado que atende"
        required
        emptyOption="Selecione"
        options={warehouses
          .filter((item) => item.ativo)
          .map((item) => ({ value: item.id, label: item.nome }))}
        hint="Sem almoxarifado, este local não consegue enviar pedido."
        error={errors.almoxarifadoId?.message}
        {...form.register("almoxarifadoId")}
      />

      <Alert tone="info">
        O CNPJ costuma ser exigido na prestação de contas do PNAE. Município que usa o CNPJ da
        própria prefeitura em todas as escolas pode repetir o mesmo número — o sistema aceita.
      </Alert>

      <InputField
        label="CNPJ"
        placeholder="Só números"
        error={errors.cnpj?.message}
        {...form.register("cnpj")}
      />

      <InputField
        label="Endereço de entrega"
        wide
        placeholder="Rua, número"
        error={errors.endereco?.message}
        {...form.register("endereco")}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
        <InputField label="Bairro" {...form.register("bairro")} />
        <InputField label="CEP" placeholder="Só números" error={errors.cep?.message} {...form.register("cep")} />
        <InputField label="Município" {...form.register("municipio")} />
        <InputField label="UF" maxLength={2} {...form.register("uf")} />
        <InputField label="Telefone" {...form.register("telefone")} />
        <InputField label="E-mail" type="email" error={errors.email?.message} {...form.register("email")} />
      </div>

      <InputField
        label="Responsável pelo recebimento"
        placeholder="Quem confere a carga quando chega"
        {...form.register("responsavel")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar local"}
        </Button>
      </div>
    </form>
  );
};
