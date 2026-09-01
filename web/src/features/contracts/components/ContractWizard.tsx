"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Gavel } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { CurrencyField } from "@/shared/ui/CurrencyField";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { ItemsEditor, emptyItem } from "@/shared/ui/ItemsEditor";
import { Alert, Card, FieldGrid, Steps, SummaryGrid } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";
import { TagSelect } from "@/shared/ui/TagSelect";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Bid } from "@/features/bids/types";
import type { PriceRecord } from "@/features/price-records/types";
import type { Supplier } from "@/features/suppliers/types";
import type { Unit } from "@/features/units/types";
import { createContract } from "../actions";
import { contractSchema, type ContractInput } from "../schemas";
import { OriginPicker } from "./OriginPicker";
import styles from "./ContractWizard.module.css";

const STEPS = ["Origem", "Dados do contrato", "Itens", "Revisão"];

export const ContractWizard = ({
  units,
  suppliers,
  bids,
  priceRecords,
  presetOrigin,
}: {
  units: Unit[];
  suppliers: Supplier[];
  bids: Bid[];
  priceRecords: PriceRecord[];
  /** Vem do assistente: origem já escolhida no passo anterior. */
  presetOrigin?: { origem: "LICITACAO" | "ATA"; id: string };
}) => {
  const router = useRouter();
  const [step, setStep] = useState(presetOrigin ? 1 : 0);

  const { form, onSubmit, isSubmitting } = useResourceForm<ContractInput>({
    schema: contractSchema as never,
    defaultValues: {
      origem: presetOrigin?.origem ?? "LICITACAO",
      numero: "",
      fornecedorId: "",
      licitacaoId: presetOrigin?.origem === "LICITACAO" ? presetOrigin.id : "",
      ataId: presetOrigin?.origem === "ATA" ? presetOrigin.id : "",
      dataInicio: "",
      dataFim: "",
      valorTotal: 0,
      fiscalNomeMatricula: "",
      unidadesDestinadas: [],
      itens: [emptyItem],
    },
    action: createContract,
    redirectTo: "/processos/contratos",
    resetOnSuccess: false,
  });

  const { errors } = form.formState;

  const values = form.watch();

  const fieldsByStep: Record<number, (keyof ContractInput)[]> = {
    0: ["origem", "licitacaoId", "ataId"],
    1: [
      "numero",
      "fornecedorId",
      "dataInicio",
      "dataFim",
      "valorTotal",
      "unidadesDestinadas",
    ],
    2: ["itens"],
  };

  const goNext = async () => {
    const valid = await form.trigger(fieldsByStep[step] as never);
    if (!valid) {
      toast.error("Revise os campos destacados antes de continuar");
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const originLabel =
    values.origem === "ATA"
      ? priceRecords.find((record) => record.id === values.ataId)?.numero
      : bids.find((bid) => bid.id === values.licitacaoId)?.numero;

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <Steps steps={STEPS} current={step} />

      {step === 0 ? (
        <Card title="De onde nasce este contrato?">
          <OriginPicker
            control={form.control}
            bids={bids}
            priceRecords={priceRecords}
          />
        </Card>
      ) : null}

      {step === 1 ? (
        <Card title="Dados do contrato">
          <div style={{ display: "grid", gap: "14px" }}>
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
                hint="Em branco: vigência indeterminada."
                error={errors.dataFim?.message}
                {...form.register("dataFim")}
              />
              <CurrencyField
                control={form.control}
                name="valorTotal"
                label="Valor total"
                required
              />
              <InputField
                label="Fiscal do contrato"
                placeholder="Maria Fiscal — mat. 1234"
                {...form.register("fiscalNomeMatricula")}
              />
            </FieldGrid>

            <TagSelect
              control={form.control}
              name="unidadesDestinadas"
              label="Unidades destinadas"
              required
              options={units.map((unit) => ({
                value: unit.id,
                label: unit.nome,
              }))}
              hint="Só estas unidades poderão solicitar itens deste contrato."
              searchPlaceholder="Buscar secretaria…"
            />
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card title="Itens do contrato">
          <ItemsEditor
            withCategory
            control={form.control}
            register={form.register}
            name="itens"
            withMeasurementMode
            expectedTotal={Number(values.valorTotal ?? 0)}
            error={errors.itens?.message}
          />
        </Card>
      ) : null}

      {step === 3 ? (
        <Card title="Revisão">
          <div style={{ display: "grid", gap: "14px" }}>
            <Alert tone="info">
              Ao confirmar, cada item nasce com saldo igual à quantidade contratada. O número de
              protocolo e o processo administrativo só são gerados quando uma unidade envia a
              primeira solicitação.
            </Alert>

            <SummaryGrid
              items={[
                {
                  label: "Origem",
                  value: `${values.origem === "ATA" ? "Ata" : "Licitação"} ${originLabel ?? ""}`,
                },
                { label: "Número", value: values.numero || "—" },
                {
                  label: "Fornecedor",
                  value:
                    suppliers.find(
                      (supplier) => supplier.id === values.fornecedorId,
                    )?.razaoSocial ?? "—",
                },
                {
                  label: "Vigência",
                  value: values.dataInicio
                    ? `${toDate(values.dataInicio)} ${
                        values.dataFim ? `a ${toDate(values.dataFim)}` : "· sem prazo definido"
                      }`
                    : "—",
                },
                {
                  label: "Valor total",
                  value: toCurrency(Number(values.valorTotal ?? 0)),
                },
                {
                  label: "Unidades",
                  value: `${values.unidadesDestinadas?.length ?? 0} selecionadas`,
                },
                { label: "Itens", value: `${values.itens?.length ?? 0}` },
              ]}
            />
          </div>
        </Card>
      ) : null}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            step === 0 ? router.push("/processos/contratos") : setStep(step - 1)
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
            {isSubmitting ? "Cadastrando…" : "Cadastrar contrato"}
          </Button>
        )}
      </div>
    </form>
  );
};

export const originIcons = { LICITACAO: Gavel, ATA: FileSignature };
