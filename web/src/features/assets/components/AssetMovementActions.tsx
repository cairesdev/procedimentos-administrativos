"use client";

import { useState } from "react";
import { ArrowRightLeft, PackageMinus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { transferAsset, writeOffAsset } from "../actions";
import {
  transferSchema, writeOffSchema,
  type TransferInput, type WriteOffInput,
} from "../schemas";
import { WRITE_OFF_REASONS, type Asset, type AssetLocation } from "../types";

/** Transferir e dar baixa, as duas ações que movem o bem de estado. */
export const AssetMovementActions = ({
  asset,
  locations,
}: {
  asset: Asset;
  locations: AssetLocation[];
}) => {
  const [dialogo, setDialogo] = useState<"transferir" | "baixa" | null>(null);

  // Bem baixado não se move nem se baixa de novo.
  if (asset.status !== "ATIVO") return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setDialogo("transferir")}
        title="Transferir para outro local"
        aria-label={`Transferir ${asset.codigoTombamento}`}
      >
        <ArrowRightLeft size={15} aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setDialogo("baixa")}
        title="Dar baixa"
        aria-label={`Dar baixa em ${asset.codigoTombamento}`}
      >
        <PackageMinus size={15} aria-hidden="true" />
      </Button>

      <Modal
        open={dialogo === "transferir"}
        onClose={() => setDialogo(null)}
        title={`Transferir ${asset.codigoTombamento}`}
        description="O bem só muda de local depois que o destino aceitar."
      >
        <TransferForm
          asset={asset}
          locations={locations}
          onDone={() => setDialogo(null)}
        />
      </Modal>

      <Modal
        open={dialogo === "baixa"}
        onClose={() => setDialogo(null)}
        title={`Dar baixa em ${asset.codigoTombamento}`}
        description="O bem sai do ativo e permanece no histórico."
      >
        <WriteOffForm asset={asset} onDone={() => setDialogo(null)} />
      </Modal>
    </>
  );
};

const TransferForm = ({
  asset,
  locations,
  onDone,
}: {
  asset: Asset;
  locations: AssetLocation[];
  onDone: () => void;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<TransferInput>({
    schema: transferSchema,
    defaultValues: { localDestinoId: "" },
    action: (values) => transferAsset(asset.id, values),
    onDone,
  });

  // O local atual não é destino, e local inativo não recebe bem.
  const destinos = locations.filter(
    (local) => local.ativo && local.id !== asset.localAtualId,
  );

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Sai de <strong>{asset.localAtualNome}</strong>. O tombamento{" "}
        <strong>{asset.codigoTombamento}</strong> não muda — ele nasceu do local de origem e
        acompanha o bem para sempre.
      </Alert>

      <SelectField
        label="Local de destino"
        required
        emptyOption="Selecione"
        options={destinos.map((local) => ({
          value: local.id,
          label: `${local.codigo} · ${local.nome}`,
        }))}
        error={form.formState.errors.localDestinoId?.message}
        {...form.register("localDestinoId")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting || destinos.length === 0}>
          {isSubmitting ? "Enviando…" : "Enviar para aceite"}
        </Button>
      </div>
    </form>
  );
};

const WriteOffForm = ({ asset, onDone }: { asset: Asset; onDone: () => void }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<WriteOffInput>({
    schema: writeOffSchema,
    defaultValues: { motivo: "QUEBRADO", observacao: "" },
    action: (values) => writeOffAsset(asset.id, values),
    onDone,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="error">
        A baixa não tem estorno. O bem sai das listagens ativas e do inventário, mas continua no
        histórico com o motivo e quem registrou.
      </Alert>

      <SelectField
        label="Motivo"
        required
        options={WRITE_OFF_REASONS}
        error={errors.motivo?.message}
        {...form.register("motivo")}
      />
      <TextareaField
        label="Observação"
        rows={3}
        placeholder="Número do processo, destino da doação, boletim de ocorrência…"
        error={errors.observacao?.message}
        {...form.register("observacao")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registrando…" : "Registrar baixa"}
        </Button>
      </div>
    </form>
  );
};
