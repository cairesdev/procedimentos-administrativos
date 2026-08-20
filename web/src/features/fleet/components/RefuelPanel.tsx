"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { FieldGrid, Table, numericCell } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { toCurrency, toDateTime } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { deleteRefuel, registerRefuel } from "../actions";
import { refuelSchema, type RefuelInput } from "../schemas";
import type { Refuel } from "../types";

const agora = () => {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 16);
};

export const RefuelPanel = ({
  tripId,
  refuels,
  canWrite,
}: {
  tripId: string;
  refuels: Refuel[];
  canWrite: boolean;
}) => {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const litros = refuels.reduce((soma, item) => soma + (item.litros ?? 0), 0);
  const valor = refuels.reduce((soma, item) => soma + (item.valor ?? 0), 0);

  const remover = async (id: string) => {
    setRemovendo(id);
    const resultado = await deleteRefuel(id, tripId);
    setRemovendo(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Abastecimento excluído");
    router.refresh();
  };

  return (
    <>
      <Table
        columns={canWrite ? ["Data", "Litros", "Valor", ""] : ["Data", "Litros", "Valor"]}
        isEmpty={refuels.length === 0}
        emptyMessage="Nenhum abastecimento lançado nesta viagem."
      >
        {refuels.map((refuel) => (
          <tr key={refuel.id}>
            <td>{toDateTime(refuel.data)}</td>
            <td className={numericCell}>{refuel.litros === null ? "—" : `${refuel.litros} L`}</td>
            <td className={numericCell}>
              {refuel.valor === null ? "—" : toCurrency(refuel.valor)}
            </td>
            {canWrite ? (
              <td>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={removendo === refuel.id}
                  onClick={() => remover(refuel.id)}
                  aria-label="Excluir abastecimento"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </Button>
              </td>
            ) : null}
          </tr>
        ))}
      </Table>

      {refuels.length > 0 ? (
        <p style={{ marginTop: "10px", fontSize: "13px" }}>
          Total: <strong>{litros.toFixed(2)} L</strong> · <strong>{toCurrency(valor)}</strong>
        </p>
      ) : null}

      {canWrite ? (
        <div style={{ marginTop: "12px" }}>
          <Button type="button" variant="secondary" onClick={() => setAberto(true)}>
            <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
            Lançar abastecimento
          </Button>
        </div>
      ) : null}

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Lançar abastecimento"
        description="Informe litros, valor, ou os dois."
      >
        <RefuelForm tripId={tripId} onDone={() => setAberto(false)} />
      </Modal>
    </>
  );
};

const RefuelForm = ({ tripId, onDone }: { tripId: string; onDone: () => void }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<RefuelInput>({
    schema: refuelSchema,
    defaultValues: { data: agora(), litros: "", valor: "" },
    action: (values) => registerRefuel(tripId, values),
    onDone,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Data e hora"
        type="datetime-local"
        required
        error={errors.data?.message}
        {...form.register("data")}
      />

      <FieldGrid>
        <InputField
          label="Litros"
          type="number"
          step="0.01"
          error={errors.litros?.message}
          {...form.register("litros")}
        />
        <InputField
          label="Valor (R$)"
          type="number"
          step="0.01"
          error={errors.valor?.message}
          {...form.register("valor")}
        />
      </FieldGrid>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Lançando…" : "Lançar"}
        </Button>
      </div>
    </form>
  );
};
