"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, FieldGrid } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { useResourceForm, type ActionResult } from "@/shared/ui/use-resource-form";
import {
  approveTrip, cancelTrip, finishTrip, refuseTrip, registerPickup, rescheduleTrip,
} from "../actions";
import {
  finishSchema, pickupSchema, refuseSchema, rescheduleSchema,
  type FinishInput, type PickupInput, type RefuseInput, type RescheduleInput,
} from "../schemas";
import { NEXT_ACTIONS, type Driver, type TripDetail } from "../types";
import styles from "./TripActions.module.css";

// Valor inicial do <input type="datetime-local">: agora, no fuso do navegador.
const agora = () => {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 16);
};

type Dialogo = "recusar" | "remarcar" | "retirada" | "finalizar" | null;

export const TripActions = ({
  trip,
  drivers,
  canManage,
}: {
  trip: TripDetail;
  drivers: Driver[];
  canManage: boolean;
}) => {
  const router = useRouter();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [executando, setExecutando] = useState(false);

  const disponiveis = NEXT_ACTIONS[trip.status];
  const fechar = () => setDialogo(null);

  const executar = async (operacao: () => Promise<ActionResult>, fallback: string) => {
    setExecutando(true);
    const resultado = await operacao();
    setExecutando(false);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? fallback);
    router.refresh();
  };

  if (disponiveis.length === 0) {
    return (
      <p className={styles.closed}>
        Viagem {trip.status.toLowerCase()} — não há mais ações disponíveis.
      </p>
    );
  }

  // Solicitante pode desistir; o resto do ciclo é de quem gere a frota.
  const podeCancelar = disponiveis.includes("cancelar");
  const acoesDeGestao = disponiveis.filter((acao) => acao !== "cancelar");

  return (
    <>
      <div className={styles.bar}>
        {canManage && acoesDeGestao.includes("aprovar") ? (
          <Button
            type="button"
            disabled={executando}
            onClick={() => executar(() => approveTrip(trip.id), "Viagem aprovada")}
          >
            Aprovar
          </Button>
        ) : null}

        {canManage && acoesDeGestao.includes("remarcar") ? (
          <Button type="button" variant="secondary" onClick={() => setDialogo("remarcar")}>
            Propor outra data
          </Button>
        ) : null}

        {canManage && acoesDeGestao.includes("recusar") ? (
          <Button type="button" variant="secondary" onClick={() => setDialogo("recusar")}>
            Recusar
          </Button>
        ) : null}

        {canManage && acoesDeGestao.includes("retirada") ? (
          <Button type="button" onClick={() => setDialogo("retirada")}>
            Registrar retirada
          </Button>
        ) : null}

        {canManage && acoesDeGestao.includes("finalizar") ? (
          <Button type="button" onClick={() => setDialogo("finalizar")}>
            Finalizar viagem
          </Button>
        ) : null}

        {podeCancelar ? (
          <Button
            type="button"
            variant="ghost"
            disabled={executando}
            onClick={() => executar(() => cancelTrip(trip.id), "Viagem cancelada")}
          >
            Cancelar viagem
          </Button>
        ) : null}
      </div>

      <Modal
        open={dialogo === "recusar"}
        onClose={fechar}
        title="Recusar viagem"
        description="O motivo fica registrado para o solicitante."
      >
        <RefuseForm tripId={trip.id} onDone={fechar} />
      </Modal>

      <Modal
        open={dialogo === "remarcar"}
        onClose={fechar}
        title="Propor outra data"
        description="A viagem volta para a mesa do solicitante como remarcada."
      >
        <RescheduleForm tripId={trip.id} onDone={fechar} />
      </Modal>

      <Modal
        open={dialogo === "retirada"}
        onClose={fechar}
        title="Registrar retirada"
        description="Confirme quem levou o veículo e o hodômetro na saída."
      >
        <PickupForm trip={trip} drivers={drivers} onDone={fechar} />
      </Modal>

      <Modal
        open={dialogo === "finalizar"}
        onClose={fechar}
        title="Finalizar viagem"
        description="O hodômetro do veículo é atualizado com o km final."
      >
        <FinishForm trip={trip} onDone={fechar} />
      </Modal>
    </>
  );
};

const RefuseForm = ({ tripId, onDone }: { tripId: string; onDone: () => void }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<RefuseInput>({
    schema: refuseSchema,
    defaultValues: { motivo: "" },
    action: (values) => refuseTrip(tripId, values),
    onDone,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <TextareaField
        label="Motivo da recusa"
        required
        rows={3}
        error={form.formState.errors.motivo?.message}
        {...form.register("motivo")}
      />
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Recusando…" : "Recusar viagem"}
        </Button>
      </div>
    </form>
  );
};

const RescheduleForm = ({ tripId, onDone }: { tripId: string; onDone: () => void }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<RescheduleInput>({
    schema: rescheduleSchema,
    defaultValues: { dataHora: agora() },
    action: (values) => rescheduleTrip(tripId, values),
    onDone,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nova data e hora"
        type="datetime-local"
        required
        error={form.formState.errors.dataHora?.message}
        {...form.register("dataHora")}
      />
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Propondo…" : "Propor data"}
        </Button>
      </div>
    </form>
  );
};

const PickupForm = ({
  trip,
  drivers,
  onDone,
}: {
  trip: TripDetail;
  drivers: Driver[];
  onDone: () => void;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<PickupInput>({
    schema: pickupSchema,
    defaultValues: {
      dataHora: agora(),
      kmInicial: 0,
      motoristaId: trip.motoristaId,
      notaCombustivelTipo: "",
      notaCombustivelQuantidade: "",
    },
    action: (values) => registerPickup(trip.id, values),
    onDone,
  });

  const { errors } = form.formState;
  const tipo = form.watch("notaCombustivelTipo");

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <FieldGrid>
        <InputField
          label="Data e hora da saída"
          type="datetime-local"
          required
          error={errors.dataHora?.message}
          {...form.register("dataHora")}
        />
        <InputField
          label="Km inicial"
          type="number"
          step="0.1"
          required
          hint="Não pode ser menor que o hodômetro registrado."
          error={errors.kmInicial?.message}
          {...form.register("kmInicial")}
        />
        <SelectField
          label="Motorista que retirou"
          required
          emptyOption="Selecione"
          options={drivers
            .filter((driver) => driver.ativo)
            .map((driver) => ({ value: driver.id, label: driver.nome }))}
          hint="Pode ser diferente de quem foi escalado."
          error={errors.motoristaId?.message}
          {...form.register("motoristaId")}
        />
      </FieldGrid>

      <FieldGrid>
        <SelectField
          label="Nota de combustível"
          emptyOption="Não emitida"
          options={[
            { value: "LITRO", label: "Por litro" },
            { value: "VALOR", label: "Por valor" },
          ]}
          error={errors.notaCombustivelTipo?.message}
          {...form.register("notaCombustivelTipo")}
        />
        <InputField
          label={tipo === "VALOR" ? "Valor (R$)" : "Litros"}
          type="number"
          step="0.01"
          disabled={!tipo}
          error={errors.notaCombustivelQuantidade?.message}
          {...form.register("notaCombustivelQuantidade")}
        />
      </FieldGrid>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registrando…" : "Registrar retirada"}
        </Button>
      </div>
    </form>
  );
};

const FinishForm = ({ trip, onDone }: { trip: TripDetail; onDone: () => void }) => {
  const kmInicial = trip.retirada?.kmInicial ?? 0;

  const { form, onSubmit, isSubmitting } = useResourceForm<FinishInput>({
    schema: finishSchema,
    defaultValues: { dataHora: agora(), kmFinal: kmInicial, sinistro: "" },
    action: (values) => finishTrip(trip.id, values),
    onDone,
  });

  const { errors } = form.formState;
  const kmFinal = Number(form.watch("kmFinal")) || 0;
  const rodados = kmFinal - kmInicial;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <FieldGrid>
        <InputField
          label="Data e hora da chegada"
          type="datetime-local"
          required
          error={errors.dataHora?.message}
          {...form.register("dataHora")}
        />
        <InputField
          label="Km final"
          type="number"
          step="0.1"
          required
          hint={`Saiu com ${kmInicial} km.`}
          error={errors.kmFinal?.message}
          {...form.register("kmFinal")}
        />
      </FieldGrid>

      {rodados > 0 ? <Alert tone="info">Percurso: {rodados.toFixed(1)} km.</Alert> : null}

      <TextareaField
        label="Sinistro ou ocorrência"
        rows={3}
        placeholder="Em branco se nada aconteceu."
        error={errors.sinistro?.message}
        {...form.register("sinistro")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Finalizando…" : "Finalizar viagem"}
        </Button>
      </div>
    </form>
  );
};
