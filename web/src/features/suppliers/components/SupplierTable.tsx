import { Table } from "@/shared/ui/layout";
import { toDocument } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import { SupplierForm } from "./SupplierForm";
import { SupplierInviteButton } from "./SupplierInviteButton";
import type { Supplier } from "../types";

export const SupplierTable = ({
  suppliers,
  canWrite,
}: {
  suppliers: Supplier[];
  canWrite: boolean;
}) => (
  <Table
    columns={canWrite ? ["Documento", "Razão social", "Contato", ""] : ["Documento", "Razão social", "Contato"]}
    isEmpty={suppliers.length === 0}
    emptyMessage="Nenhum fornecedor encontrado."
  >
    {suppliers.map((supplier) => (
      <tr key={supplier.id}>
        <td>{toDocument(supplier.documento)}</td>
        <td>{supplier.razaoSocial}</td>
        <td>{supplier.email ?? supplier.telefone ?? "—"}</td>
        {canWrite ? (
          <td>
            <RowActions
              label={supplier.razaoSocial}
              editTitle="Editar fornecedor"
              editDescription="Cadastro global: a alteração vale para todas as prefeituras e fica no histórico."
              editForm={<SupplierForm supplier={supplier} />}
              extraLabel="Link para o fornecedor"
              extraTitle="Link para o fornecedor completar o cadastro"
              extraDescription="Ele abre sem login e corrige os próprios dados."
              extraForm={
                <SupplierInviteButton
                  supplierId={supplier.id}
                  razaoSocial={supplier.razaoSocial}
                />
              }
            />
          </td>
        ) : null}
      </tr>
    ))}
  </Table>
);
