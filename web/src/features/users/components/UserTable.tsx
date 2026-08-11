import { Badge, Table } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import type { User } from "../types";

export const UserTable = ({ users }: { users: User[] }) => (
  <Table
    columns={["Nome", "E-mail", "Papel", "Situação"]}
    isEmpty={users.length === 0}
    emptyMessage="Nenhum usuário cadastrado."
  >
    {users.map((user) => (
      <tr key={user.id}>
        <td>{user.nome}</td>
        <td>{user.email}</td>
        <td>
          <Badge tone="accent">{humanize(user.papelBase)}</Badge>
        </td>
        <td>
          <Badge tone={user.ativo ? "success" : "neutral"}>
            {user.ativo ? "ativo" : "inativo"}
          </Badge>
        </td>
      </tr>
    ))}
  </Table>
);
