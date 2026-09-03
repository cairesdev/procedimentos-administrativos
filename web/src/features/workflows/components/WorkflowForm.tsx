"use client";

import { useFieldArray } from "react-hook-form";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { FieldGrid } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Sector } from "@/features/sectors/types";
import { saveWorkflow } from "../actions";
import { workflowSchema, type WorkflowInput } from "../schemas";
import { PROCESS_TYPES, type Workflow } from "../types";
import styles from "./WorkflowForm.module.css";

const emptyStep = {
  setorId: "",
  prazoDias: 0,
  prazoAtivo: false,
  visibilidadeEstendida: false,
};

export const WorkflowForm = ({
  sectors,
  workflow,
  processType,
}: {
  sectors: Sector[];
  workflow: Workflow | null;
  processType: string;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<WorkflowInput>({
    schema: workflowSchema as never,
    defaultValues: {
      tipoProcesso: processType as WorkflowInput["tipoProcesso"],
      permiteOverrideUsuario: workflow?.permiteOverrideUsuario ?? false,
      etapas:
        workflow?.etapas.map((step) => ({
          setorId: step.setorId,
          prazoDias: step.prazoDias ?? 0,
          prazoAtivo: step.prazoAtivo,
          visibilidadeEstendida: step.visibilidadeEstendida,
        })) ?? [emptyStep],
    },
    action: saveWorkflow,
    resetOnSuccess: false,
  });

  const { errors } = form.formState;
  const steps = useFieldArray({ control: form.control, name: "etapas" });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "16px" }}>
      <SelectField
        label="Tipo de processo"
        required
        options={PROCESS_TYPES.map((type) => ({ value: type, label: humanize(type) }))}
        {...form.register("tipoProcesso")}
      />

      <label className={styles.checkbox}>
        <input type="checkbox" {...form.register("permiteOverrideUsuario")} />
        Permitir que o usuário escolha o setor de destino manualmente
      </label>

      <div className={styles.steps}>
        <div className={styles.steps_header}>
          <span>Etapas na ordem de tramitação</span>
          <Button type="button" variant="secondary" onClick={() => steps.append(emptyStep)}>
            Adicionar etapa
          </Button>
        </div>

        {steps.fields.map((field, index) => (
          <div key={field.id} className={styles.step}>
            <span className={styles.step_order}>{index + 1}</span>

            <div className={styles.step_body}>
              <FieldGrid>
                <SelectField
                  label="Setor"
                  required
                  emptyOption="Selecione"
                  options={sectors.map((sector) => ({ value: sector.id, label: sector.nome }))}
                  error={errors.etapas?.[index]?.setorId?.message}
                  {...form.register(`etapas.${index}.setorId`)}
                />
                <InputField
                  label="Prazo (dias)"
                  type="number"
                  min={0}
                  {...form.register(`etapas.${index}.prazoDias`)}
                />
              </FieldGrid>

              <div className={styles.step_flags}>
                <label className={styles.checkbox}>
                  <input type="checkbox" {...form.register(`etapas.${index}.prazoAtivo`)} />
                  Cobrar prazo
                </label>
                {/*
                  "Ver processos fora da etapa" saiu daqui.
                  ------------------------------------------------------------
                  A opção existia, era gravada em `fluxo_estagio` e **nenhuma
                  consulta a lia**: marcar ou desmarcar não mudava o que
                  ninguém enxergava. É a terceira da família no projeto —
                  `dados_contratante` e `usuario_permissao` foram as outras
                  duas, e cada uma custou um bug de "configurei e não
                  funciona".

                  O valor continua no formulário e volta ao banco como veio: o
                  dia em que alguém escrever a consulta, a configuração de quem
                  já marcou está lá. Enquanto ninguém a lê, não se oferece —
                  melhor não prometer do que prometer sem efeito.
                */}
                {steps.fields.length > 1 ? (
                  <button type="button" className={styles.remove} onClick={() => steps.remove(index)}>
                    Remover
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar fluxo"}
        </Button>
      </div>
    </form>
  );
};
