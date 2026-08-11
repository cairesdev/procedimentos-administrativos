import { Badge, Table, numericCell } from "@/shared/ui/layout";
import { toCurrency, toDate } from "@/shared/ui/labels";
import type { Supplier } from "@/features/suppliers/types";
import type { Contract } from "../types";

const validityTone = (endDate: string) => {
  const remainingDays = (new Date(endDate).getTime() - Date.now()) / 86_400_000;
  if (remainingDays < 0) return { tone: "warning" as const, label: "vencido" };
  if (remainingDays <= 30) return { tone: "warning" as const, label: "vence em 30d" };
  return { tone: "success" as const, label: "vigente" };
};

export const ContractTable = ({
  contracts,
  suppliers,
}: {
  contracts: Contract[];
  suppliers: Supplier[];
}) => {
  const supplierName = (id: string) =>
    suppliers.find((supplier) => supplier.id === id)?.razaoSocial ?? "—";

  return (
    <Table
      columns={["Número", "Fornecedor", "Vigência", "Valor", "Situação"]}
      isEmpty={contracts.length === 0}
      emptyMessage="Nenhum contrato cadastrado."
    >
      {contracts.map((contract) => {
        const validity = validityTone(contract.dataFim);
        return (
          <tr key={contract.id}>
            <td>{contract.numero}</td>
            <td>{supplierName(contract.fornecedorId)}</td>
            <td>
              {toDate(contract.dataInicio)} a {toDate(contract.dataFim)}
            </td>
            <td className={numericCell}>{toCurrency(contract.valorTotal)}</td>
            <td>
              <Badge tone={validity.tone}>{validity.label}</Badge>
            </td>
          </tr>
        );
      })}
    </Table>
  );
};
