"use client";

import { humanize, toCurrency } from "@/shared/ui/labels";
import type { ContractItem } from "@/features/contracts/types";
import { LinhasPorCategoria } from "@/shared/ui/LinhasPorCategoria";
import styles from "./ItemPicker.module.css";

const unitLabel = (item: ContractItem) =>
  item.modoMedicao === "PERCENTUAL" ? "%" : item.modoMedicao === "VALOR" ? "R$" : item.unidadeMedida;

const lineValue = (item: ContractItem, quantity: number) => {
  if (item.modoMedicao === "PERCENTUAL") return (quantity / 100) * item.valorTotal;
  if (item.modoMedicao === "VALOR") return quantity;
  return quantity * item.valorUnitario;
};

/**
 * Itens de UM contrato, separados por categoria.
 *
 * O cabeçalho com número e fornecedor fica na linha do contrato, que é quem
 * abre esta lista — repetir aqui só empurraria a tabela para baixo.
 *
 * As categorias viram faixas dentro da mesma tabela, e não tabelas separadas:
 * assim as colunas continuam alinhadas de ponta a ponta, e quem compara saldo
 * entre duas frentes não precisa medir duas grades diferentes com o olho. O
 * bloco sem categoria vem por último e sem faixa quando é o único — nomear "sem
 * categoria" num contrato que não usa categorias seria inventar um problema.
 */
export const ItemPicker = ({
  itens,
  escolhas,
  onChange,
}: {
  itens: ContractItem[];
  escolhas: Record<string, number>;
  onChange: (item: ContractItem, quantidade: number) => void;
}) => (
  <div className={styles.wrapper}>
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
        <LinhasPorCategoria itens={itens} colunas={5}>
          {(item) => {
            const quantity = escolhas[item.id] ?? 0;
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
                    onChange={(event) => onChange(item, Number(event.target.value))}
                  />
                  {exceeded ? <span className={styles.error}>Acima do saldo</span> : null}
                </td>
                <td className={styles.numeric}>
                  {quantity > 0 ? toCurrency(lineValue(item, quantity)) : "—"}
                </td>
              </tr>
            );
          }}
        </LinhasPorCategoria>
      </tbody>
    </table>
  </div>
);
