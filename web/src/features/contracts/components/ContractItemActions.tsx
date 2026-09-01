"use client";

import { RowActions } from "@/shared/ui/RowActions";
import { deleteContractItem } from "../actions";
import { ContractItemForm } from "./ContractItemForm";
import type { ContractItem } from "../types";

/**
 * Corrigir ou excluir um item do contrato.
 *
 * A exclusão só é oferecida a item que ninguém pediu: com consumo, a API
 * recusa — a solicitação antiga aponta para ele —, e um botão que só produz
 * erro é pior que botão nenhum.
 */
export const ContractItemActions = ({
  contractId,
  item,
}: {
  contractId: string;
  item: ContractItem;
}) => {
  const intocado = item.saldoDisponivel === item.quantidadeTotal;

  return (
    <RowActions
      label={item.produto}
      editTitle="Corrigir item"
      editDescription="A quantidade não pode ficar abaixo do que já saiu em solicitações."
      editForm={<ContractItemForm contractId={contractId} item={item} />}
      onDelete={intocado ? deleteContractItem.bind(null, contractId, item.id) : undefined}
      deleteWarning="O item sai do contrato. Só é possível enquanto ninguém o tiver pedido."
    />
  );
};
