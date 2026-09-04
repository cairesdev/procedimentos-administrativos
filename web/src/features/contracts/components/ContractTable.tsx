import Link from "next/link";
import { Badge, EmptyState, Table, numericCell } from "@/shared/ui/layout";
import { LinkButton } from "@/shared/ui/button";
import { toCurrency, toDate } from "@/shared/ui/labels";
import type { Supplier } from "@/features/suppliers/types";
import type { Unit } from "@/features/units/types";
import { RowActions } from "@/shared/ui/RowActions";
import { deleteContract } from "../actions";
import { ContractEditForm } from "./ContractEditForm";
import type { Contract } from "../types";

const validityTone = (endDate: string | null) => {
  if (!endDate) return { tone: "success" as const, label: "sem prazo" };
  const remainingDays = (new Date(endDate).getTime() - Date.now()) / 86_400_000;
  if (remainingDays < 0) return { tone: "warning" as const, label: "vencido" };
  if (remainingDays <= 30) return { tone: "warning" as const, label: "vence em 30d" };
  return { tone: "success" as const, label: "vigente" };
};

export const ContractTable = ({
  contracts,
  suppliers,
  units,
  canWrite,
}: {
  contracts: Contract[];
  suppliers: Supplier[];
  units: Unit[];
  canWrite: boolean;
}) => {
  const supplierName = (id: string) =>
    suppliers.find((supplier) => supplier.id === id)?.razaoSocial ?? "—";

  return (
    <Table
      columns={
        canWrite
          ? ["Número", "Fornecedor", "Vigência", "Valor", "Situação", ""]
          : ["Número", "Fornecedor", "Vigência", "Valor", "Situação"]
      }
      isEmpty={contracts.length === 0}
      emptyMessage="Nenhum contrato cadastrado."
      empty={
        <EmptyState
          titulo="Nenhum contrato cadastrado"
          descricao={
            "O contrato traz os itens que as unidades vão pedir. Sem ele, a "
            + "solicitação não tem de onde puxar produto nem saldo."
          }
          acao={canWrite ? <LinkButton href="/processos/contratos/novo" variant="primary">
            Cadastrar contrato
          </LinkButton> : undefined}
        />
      }
    >
      {contracts.map((contract) => {
        const validity = validityTone(contract.dataFim);
        return (
          <tr key={contract.id}>
            <td>
              <Link href={`/processos/contratos/${contract.id}`} style={{ color: "var(--acao)" }}>
                {contract.numero}
              </Link>
            </td>
            <td>{supplierName(contract.fornecedorId)}</td>
            <td>
              {toDate(contract.dataInicio)}
              {contract.dataFim ? ` a ${toDate(contract.dataFim)}` : " · indeterminada"}
            </td>
            <td className={numericCell}>{toCurrency(contract.valorTotal)}</td>
            <td>
              <Badge tone={validity.tone}>{validity.label}</Badge>
            </td>
            {canWrite ? (
              <td>
                <RowActions
                  label={`contrato ${contract.numero}`}
                  editTitle="Editar contrato"
                  editForm={<ContractEditForm contract={contract} units={units} />}
                  onDelete={deleteContract.bind(null, contract.id)}
                  deleteWarning="Contrato com solicitação, ordem ou saldo consumido não pode ser excluído."
                />
              </td>
            ) : null}
          </tr>
        );
      })}
    </Table>
  );
};
