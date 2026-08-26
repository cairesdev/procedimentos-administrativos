import { Badge, Table, numericCell } from "@/shared/ui/layout";
import type { StockRequestItem } from "../types";

const formatar = (valor: number | null) =>
  valor === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);

/**
 * Pedido, reservado, liberado e recebido lado a lado.
 *
 * As quatro colunas contam a história inteira: onde liberado é menor que
 * pedido houve atendimento parcial; onde recebido é menor que liberado houve
 * perda no caminho.
 */
export const RequestItems = ({ itens }: { itens: StockRequestItem[] }) => (
  <Table
    columns={["Produto", "Pedido", "Reservado", "Liberado", "Recebido"]}
    isEmpty={itens.length === 0}
    emptyMessage="Nenhum item neste pedido."
  >
    {itens.map((item) => {
      const parcial =
        item.quantidadeLiberada !== null && item.quantidadeLiberada < item.quantidadeSolicitada;
      const perdeu =
        item.quantidadeRecebida !== null
        && item.quantidadeLiberada !== null
        && item.quantidadeRecebida < item.quantidadeLiberada;

      return (
        <tr key={item.id}>
          <td>
            <strong>{item.produtoNome}</strong>
            <br />
            <small>{item.unidadeMedida}</small>
          </td>
          <td className={numericCell}>{formatar(item.quantidadeSolicitada)}</td>
          <td className={numericCell}>
            {item.quantidadeReservada > 0 ? formatar(item.quantidadeReservada) : "—"}
          </td>
          <td className={numericCell}>
            {formatar(item.quantidadeLiberada)}{" "}
            {parcial ? <Badge tone="warning">parcial</Badge> : null}
          </td>
          <td className={numericCell}>
            {formatar(item.quantidadeRecebida)}{" "}
            {perdeu ? <Badge tone="warning">com perda</Badge> : null}
          </td>
        </tr>
      );
    })}
  </Table>
);
