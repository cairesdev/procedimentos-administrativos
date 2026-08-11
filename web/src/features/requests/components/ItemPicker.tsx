"use client";

import { Card } from "@/shared/ui/layout";
import { humanize, toCurrency } from "@/shared/ui/labels";
import type { ContractItem } from "@/features/contracts/types";
import type { ContractWithItems } from "./RequestBuilder";
import styles from "./ItemPicker.module.css";

const unitLabel = (item: ContractItem) =>
  item.modoMedicao === "PERCENTUAL" ? "%" : item.modoMedicao === "VALOR" ? "R$" : item.unidadeMedida;

const lineValue = (item: ContractItem, quantity: number) => {
  if (item.modoMedicao === "PERCENTUAL") return (quantity / 100) * item.valorTotal;
  if (item.modoMedicao === "VALOR") return quantity;
  return quantity * item.valorUnitario;
};

export const ItemPicker = ({
  contract,
  chosen,
  onChange,
}: {
  contract: ContractWithItems;
  chosen: Record<string, number>;
  onChange: (itemId: string, quantity: number) => void;
}) => (
  <Card title={`Contrato ${contract.numero} · ${contract.fornecedor}`} padded={false}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Item</th>
          <th className={styles.numeric}>Saldo disponível</th>
          <th className={styles.numeric}>Valor de referência</th>
          <th style={{ width: "150px" }}>Quantidade</th>
          <th className={styles.numeric}>Valor do pedido</th>
        </tr>
      </thead>
      <tbody>
        {contract.itens.map((item) => {
          const quantity = chosen[item.id] ?? 0;
          const exceeded = quantity > item.saldoDisponivel;

          return (
            <tr key={item.id} className={quantity > 0 ? styles.row_chosen : ""}>
              <td>
                <span className={styles.product}>{item.produto}</span>
                <span className={styles.mode}>
                  {humanize(item.modoMedicao)}
                  {item.marca ? ` · ${item.marca}` : ""}
                </span>
              </td>
              <td className={styles.numeric}>
                <span className={item.saldoDisponivel === 0 ? styles.empty : ""}>
                  {item.saldoDisponivel.toLocaleString("pt-BR")} {unitLabel(item)}
                </span>
                <span className={styles.of_total}>
                  de {item.quantidadeTotal.toLocaleString("pt-BR")}
                </span>
              </td>
              <td className={styles.numeric}>
                {item.modoMedicao === "UNIDADE"
                  ? `${toCurrency(item.valorUnitario)} / ${item.unidadeMedida}`
                  : toCurrency(item.valorTotal)}
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={item.saldoDisponivel}
                  step={item.modoMedicao === "UNIDADE" ? 1 : 0.01}
                  disabled={item.saldoDisponivel === 0}
                  className={`${styles.quantity} ${exceeded ? styles.quantity_invalid : ""}`}
                  value={quantity || ""}
                  placeholder="0"
                  onChange={(event) => onChange(item.id, Number(event.target.value))}
                />
                {exceeded ? <span className={styles.error}>Acima do saldo</span> : null}
              </td>
              <td className={styles.numeric}>
                {quantity > 0 ? toCurrency(lineValue(item, quantity)) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </Card>
);
