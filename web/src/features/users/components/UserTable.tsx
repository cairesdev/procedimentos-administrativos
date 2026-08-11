import { Badge, Table } from "@/shared/ui/layout";
import { humanize } from "@/shared/ui/labels";
import { RowActions } from "@/shared/ui/RowActions";
import type { Option } from "@/shared/ui/form-field";
import { deleteUser, setUserActive } from "../actions";
import { UserForm } from "./UserForm";
import type { User } from "../types";

export const UserTable = ({
  users,
  canWrite,
  assignmentOptions,
}: {
  users: User[];
  canWrite: boolean;
  assignmentOptions: Option[];
}) => (
  <Table
    columns={
      canWrite
        ? ["Nome", "E-mail", "Papel", "Situação", ""]
        : ["Nome", "E-mail", "Papel", "Situação"]
    }
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
        {canWrite ? (
          <td>
            <RowActions
              label={user.nome}
              editTitle="Editar usuário"
              editDescription="Nome de usuário e lotação não mudam por aqui."
              editForm={<UserForm user={user} assignmentOptions={assignmentOptions} />}
              isActive={user.ativo}
              onToggleActive={setUserActive.bind(null, user.id, !user.ativo)}
              onDelete={deleteUser.bind(null, user.id)}
              deleteWarning="Quem já despachou, deu parecer ou gerou auditoria não pode ser excluído — inative."
            />
          </td>
        ) : null}
      </tr>
    ))}
  </Table>
);
