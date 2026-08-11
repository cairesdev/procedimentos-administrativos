"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { SelectField } from "@/shared/ui/form-field";
import { Alert, Card, Stack, SummaryGrid } from "@/shared/ui/layout";
import { toCurrency } from "@/shared/ui/labels";
import type { Contract, ContractItem } from "@/features/contracts/types";
import type { Unit } from "@/features/units/types";
import { createAndSendRequest, saveDraft } from "../actions";
import { ItemPicker } from "./ItemPicker";
import styles from "./RequestBuilder.module.css";

export type ContractWithItems = Contract & { itens: ContractItem[]; fornecedor: string };

export type ChosenItem = {
  itemId: string;
  quantidade: number;
};

// Itens de contratos diferentes convivem na mesma solicitação — cada um
// mantém o vínculo com seu contrato, como definido no levantamento.
export const RequestBuilder = ({
  units,
  contracts,
}: {
  units: Unit[];
  contracts: ContractWithItems[];
}) => {
  const router = useRouter();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const itemsById = useMemo(() => {
    const map = new Map<string, { item: ContractItem; contract: ContractWithItems }>();
    for (const contract of contracts) {
      for (const item of contract.itens) map.set(item.id, { item, contract });
    }
    return map;
  }, [contracts]);

  const chosenEntries = Object.entries(chosen).filter(([, quantity]) => quantity > 0);

  const total = chosenEntries.reduce((sum, [itemId, quantity]) => {
    const found = itemsById.get(itemId);
    if (!found) return sum;
    const { modoMedicao, valorUnitario, valorTotal } = found.item;
    if (modoMedicao === "PERCENTUAL") return sum + (quantity / 100) * valorTotal;
    if (modoMedicao === "VALOR") return sum + quantity;
    return sum + quantity * valorUnitario;
  }, 0);

  const involvedContracts = new Set(
    chosenEntries.map(([itemId]) => itemsById.get(itemId)?.contract.numero).filter(Boolean),
  );

  const setQuantity = (itemId: string, quantity: number) =>
    setChosen((current) => ({ ...current, [itemId]: quantity }));

  const submit = async (mode: "draft" | "send") => {
    if (!unitId) {
      toast.error("Escolha a unidade solicitante");
      return;
    }
    if (chosenEntries.length === 0) {
      toast.error("Escolha ao menos um item");
      return;
    }

    setBusy(true);
    const payload = {
      unidadeSolicitanteId: unitId,
      itens: chosenEntries.map(([itemId, quantidade]) => ({
        itemId,
        quantidadeSolicitada: quantidade,
      })),
    };
    const result = mode === "send"
      ? await createAndSendRequest(payload)
      : await saveDraft(payload);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success ?? "Solicitação registrada");
    setChosen({});
    router.push(mode === "send" ? "/processos" : "/solicitacoes");
    router.refresh();
  };

  return (
    <Stack>
      <Card title="Unidade solicitante">
        <SelectField
          name="unidadeSolicitanteId"
          label="Em nome de qual unidade"
          required
          emptyOption="Selecione"
          options={units.map((unit) => ({ value: unit.id, label: unit.nome }))}
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          hint="Só aparecem contratos destinados à unidade escolhida."
        />
      </Card>

      {contracts.length === 0 ? (
        <Alert tone="info">
          Nenhum contrato vigente com itens disponíveis. Cadastre um contrato antes de solicitar.
        </Alert>
      ) : (
        contracts.map((contract) => (
          <ItemPicker
            key={contract.id}
            contract={contract}
            chosen={chosen}
            onChange={setQuantity}
          />
        ))
      )}

      <Card title="Resumo do pedido">
        <Stack>
          <SummaryGrid
            items={[
              { label: "Itens escolhidos", value: `${chosenEntries.length}` },
              { label: "Contratos envolvidos", value: `${involvedContracts.size}` },
              { label: "Valor estimado", value: toCurrency(total) },
            ]}
          />

          <Alert tone="info">
            Ao enviar, o sistema gera protocolo e processo administrativo e reserva o saldo dos
            itens. O saldo só volta se a solicitação for cancelada ou receber parecer desfavorável.
          </Alert>

          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => submit("draft")}
            >
              Salvar rascunho
            </Button>
            <Button type="button" disabled={busy} onClick={() => submit("send")}>
              <Send size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              {busy ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  );
};

export const quantityIcons = { Plus, Minus };
