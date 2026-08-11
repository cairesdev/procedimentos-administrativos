import { Table } from "@/shared/ui/layout";
import { toDocument } from "@/shared/ui/labels";
import type { Supplier } from "../types";

export const SupplierTable = ({ suppliers }: { suppliers: Supplier[] }) => (
  <Table
    columns={["Documento", "Razão social", "Contato"]}
    isEmpty={suppliers.length === 0}
    emptyMessage="Nenhum fornecedor encontrado."
  >
    {suppliers.map((supplier) => (
      <tr key={supplier.id}>
        <td>{toDocument(supplier.documento)}</td>
        <td>{supplier.razaoSocial}</td>
        <td>{supplier.email ?? supplier.telefone ?? "—"}</td>
      </tr>
    ))}
  </Table>
);
