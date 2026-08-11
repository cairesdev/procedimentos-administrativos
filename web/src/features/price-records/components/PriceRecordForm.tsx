"use client";

import { Button } from "@/shared/ui/button";
import { CurrencyField } from "@/shared/ui/CurrencyField";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { ItemsEditor, emptyItem } from "@/shared/ui/ItemsEditor";
import { Alert, Card, FieldGrid, Stack } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Bid } from "@/features/bids/types";
import { createPriceRecord } from "../actions";
import { priceRecordSchema, type PriceRecordInput } from "../schemas";

export const PriceRecordForm = ({ bids }: { bids: Bid[] }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<PriceRecordInput>({
    schema: priceRecordSchema as never,
    defaultValues: {
      numero: "",
      licitacaoId: "",
      objeto: "",
      dataAssinatura: "",
      dataVigencia: "",
      valorTotal: 0,
      itens: [emptyItem],
    },
    action: createPriceRecord,
    redirectTo: "/atas",
    resetOnSuccess: false,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit}>
      <Stack>
        <Card title="Dados da ata">
          <div style={{ display: "grid", gap: "14px" }}>
            <FieldGrid>
              <InputField
                label="Número/ano"
                required
                placeholder="010/2026"
                error={errors.numero?.message}
                {...form.register("numero")}
              />
              <SelectField
                label="Licitação de origem"
                emptyOption="Sem vínculo"
                options={bids.map((bid) => ({ value: bid.id, label: bid.numero }))}
                hint="Opcional: a ata pode existir sem licitação registrada no sistema."
                {...form.register("licitacaoId")}
              />
              <InputField
                label="Data de assinatura"
                type="date"
                required
                error={errors.dataAssinatura?.message}
                {...form.register("dataAssinatura")}
              />
              <InputField
                label="Vigência até"
                type="date"
                required
                hint="Vencida, a ata alerta mas não bloqueia."
                error={errors.dataVigencia?.message}
                {...form.register("dataVigencia")}
              />
              <CurrencyField
                control={form.control}
                name="valorTotal"
                label="Valor total"
                required
              />
            </FieldGrid>

            <TextareaField
              label="Objeto"
              required
              error={errors.objeto?.message}
              {...form.register("objeto")}
            />
          </div>
        </Card>

        <Card title="Itens registrados">
          <Alert tone="info">
            Copie as linhas da planilha e cole aqui — as colunas são reconhecidas automaticamente.
          </Alert>
          <div style={{ marginTop: "12px" }}>
            <ItemsEditor
              control={form.control}
              register={form.register}
              name="itens"
              expectedTotal={Number(form.watch("valorTotal") ?? 0)}
              error={errors.itens?.message}
            />
          </div>
        </Card>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Cadastrando…" : "Cadastrar ata"}
          </Button>
        </div>
      </Stack>
    </form>
  );
};
