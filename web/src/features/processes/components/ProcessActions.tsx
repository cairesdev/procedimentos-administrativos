"use client";

import { useState } from "react";
import { FileCheck2, Forward, MessageSquare, Receipt } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { CurrencyField } from "@/shared/ui/CurrencyField";
import { InputField, SelectField, TextareaField, type Option } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import type { Assignment } from "@/features/auth/types";
import { dispatchProcess, emitOpinion, emitSupplyOrder } from "../actions";
import {
  dispatchSchema, opinionSchema, supplyOrderSchema,
  type DispatchInput, type OpinionInput, type SupplyOrderInput,
} from "../schemas";
import styles from "./ProcessActions.module.css";

type Panel = "dispatch" | "opinion" | "order" | null;

type ProcessActionsProps = {
  processId: string;
  assignments: Assignment[];
  activeAssignmentId?: string;
  sectors: Option[];
  contracts: Option[];
  canDispatch: boolean;
  canGiveOpinion: boolean;
  canEmitOrder: boolean;
  allowManualDestination: boolean;
};

export const ProcessActions = ({
  processId,
  assignments,
  activeAssignmentId,
  sectors,
  contracts,
  canDispatch,
  canGiveOpinion,
  canEmitOrder,
  allowManualDestination,
}: ProcessActionsProps) => {
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);

  const assignmentOptions = assignments.map((assignment) => ({
    value: assignment.id,
    label: assignment.destino,
  }));
  const defaultAssignment = activeAssignmentId ?? assignments[0]?.id ?? "";

  const dispatchForm = useResourceForm<DispatchInput>({
    schema: dispatchSchema as never,
    defaultValues: {
      lotacaoId: defaultAssignment,
      tipo: "ANALISE",
      texto: "",
      destinoSetorId: "",
    },
    action: (values) => dispatchProcess(processId, values),
    resetOnSuccess: false,
    onDone: close,
  });

  const opinionForm = useResourceForm<OpinionInput>({
    schema: opinionSchema as never,
    defaultValues: { lotacaoId: defaultAssignment, favoravel: "sim", justificativa: "" },
    action: (values) => emitOpinion(processId, values),
    resetOnSuccess: false,
    onDone: close,
  });

  const orderForm = useResourceForm<SupplyOrderInput>({
    schema: supplyOrderSchema as never,
    defaultValues: {
      lotacaoId: defaultAssignment,
      contratoId: contracts[0]?.value ?? "",
      valor: 0,
      numeroEmpenho: "",
      numeroNotaFiscal: "",
    },
    action: (values) => emitSupplyOrder(processId, values),
    resetOnSuccess: false,
    onDone: close,
  });

  if (assignments.length === 0) {
    return (
      <Alert tone="info">
        Você não tem lotação definida, então não pode agir neste processo. Peça ao administrador
        para vincular você a um setor.
      </Alert>
    );
  }

  const isForwarding = dispatchForm.form.watch("tipo") === "ENCAMINHAMENTO";

  return (
    <div className={styles.actions}>
      <div className={styles.buttons}>
        {canDispatch ? (
          <Button type="button" onClick={() => setPanel("dispatch")}>
            <Forward size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Despachar
          </Button>
        ) : null}
        {canEmitOrder ? (
          <Button type="button" variant="secondary" onClick={() => setPanel("order")}>
            <Receipt size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Ordem de fornecimento
          </Button>
        ) : null}
        {canGiveOpinion ? (
          <Button type="button" variant="secondary" onClick={() => setPanel("opinion")}>
            <FileCheck2 size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Emitir parecer
          </Button>
        ) : null}
        {!canDispatch && !canEmitOrder && !canGiveOpinion ? (
          <Alert tone="info">Seu papel não age neste processo — acompanhamento apenas.</Alert>
        ) : null}
      </div>

      <Modal
        open={panel === "dispatch"}
        onClose={close}
        title="Despachar processo"
        description="Análise registra sua manifestação; encaminhamento move para a próxima etapa."
      >
        <form onSubmit={dispatchForm.onSubmit} className={styles.form}>
          <SelectField
            label="Atuando como"
            required
            options={assignmentOptions}
            {...dispatchForm.form.register("lotacaoId")}
          />
          <SelectField
            label="Tipo de despacho"
            required
            options={[
              { value: "ANALISE", label: "Análise (permanece no setor)" },
              { value: "ENCAMINHAMENTO", label: "Encaminhamento (segue o fluxo)" },
            ]}
            {...dispatchForm.form.register("tipo")}
          />
          {isForwarding && allowManualDestination ? (
            <SelectField
              label="Destino"
              emptyOption="Próxima etapa do fluxo"
              options={sectors}
              hint="Esta prefeitura permite escolher o setor manualmente."
              {...dispatchForm.form.register("destinoSetorId")}
            />
          ) : null}
          <TextareaField
            label="Despacho"
            placeholder="Processo autuado e conferido."
            {...dispatchForm.form.register("texto")}
          />
          <Button type="submit" disabled={dispatchForm.isSubmitting}>
            <MessageSquare size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            {dispatchForm.isSubmitting ? "Registrando…" : "Registrar despacho"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={panel === "opinion"}
        onClose={close}
        title="Parecer da Controladoria"
        description="O parecer encerra o processo."
      >
        <form onSubmit={opinionForm.onSubmit} className={styles.form}>
          <SelectField
            label="Atuando como"
            required
            options={assignmentOptions}
            {...opinionForm.form.register("lotacaoId")}
          />

          <div className={styles.radios}>
            <label className={styles.radio}>
              <input type="radio" value="sim" {...opinionForm.form.register("favoravel")} />
              Favorável
            </label>
            <label className={styles.radio}>
              <input type="radio" value="nao" {...opinionForm.form.register("favoravel")} />
              Desfavorável
            </label>
          </div>

          <Alert tone="info">
            Parecer desfavorável devolve o saldo reservado aos contratos.
          </Alert>

          <TextareaField
            label="Justificativa"
            placeholder="Regularidade confirmada."
            {...opinionForm.form.register("justificativa")}
          />
          <Button type="submit" disabled={opinionForm.isSubmitting}>
            {opinionForm.isSubmitting ? "Registrando…" : "Registrar parecer"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={panel === "order"}
        onClose={close}
        title="Ordem de fornecimento"
        description="Uma ordem por contrato envolvido no processo."
      >
        <form onSubmit={orderForm.onSubmit} className={styles.form}>
          <SelectField
            label="Atuando como"
            required
            options={assignmentOptions}
            {...orderForm.form.register("lotacaoId")}
          />
          <SelectField
            label="Contrato"
            required
            emptyOption="Selecione"
            options={contracts}
            {...orderForm.form.register("contratoId")}
          />
          <CurrencyField control={orderForm.form.control} name="valor" label="Valor" required />

          <FieldGrid>
            <InputField
              label="Número do empenho"
              placeholder="2026NE000123"
              {...orderForm.form.register("numeroEmpenho")}
            />
            <InputField
              label="Nota fiscal"
              hint="Única por fornecedor nesta prefeitura."
              {...orderForm.form.register("numeroNotaFiscal")}
            />
            <InputField label="Requisição" {...orderForm.form.register("numeroRequisicao")} />
            <InputField label="Projeto/atividade" {...orderForm.form.register("projetoAtividade")} />
            <InputField label="Elemento de despesa" {...orderForm.form.register("elementoDespesa")} />
            <InputField label="Fonte de recurso" {...orderForm.form.register("fonteRecurso")} />
            <InputField
              label="Parcelas"
              type="number"
              min={1}
              {...orderForm.form.register("numeroParcelas")}
            />
          </FieldGrid>

          <Button type="submit" disabled={orderForm.isSubmitting}>
            {orderForm.isSubmitting ? "Emitindo…" : "Emitir ordem"}
          </Button>
        </form>
      </Modal>
    </div>
  );
};
