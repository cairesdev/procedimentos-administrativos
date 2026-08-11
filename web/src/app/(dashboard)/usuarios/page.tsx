import { listSectors } from "@/features/sectors/queries";
import { listUnits } from "@/features/units/queries";
import { listUsers } from "@/features/users/queries";
import { UserForm } from "@/features/users/components/UserForm";
import { UserTable } from "@/features/users/components/UserTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, Columns, PageHeader } from "@/shared/ui/layout";

export default async function UsersPage() {
  const viewer = await requirePermission("users:read");
  const [users, units, sectors] = await Promise.all([listUsers(), listUnits(), listSectors()]);

  const assignmentOptions = [
    ...units.map((unit) => ({ value: `unidade:${unit.id}`, label: `Unidade · ${unit.nome}` })),
    ...sectors.map((sector) => ({ value: `setor:${sector.id}`, label: `Setor · ${sector.nome}` })),
  ];

  return (
    <>
      <PageHeader title="Usuários" subtitle="Servidores com acesso ao sistema desta prefeitura" />

      <Columns>
        <Card title={`${users.length} cadastrados`} padded={false}>
          <UserTable users={users} />
        </Card>

        {viewer.can("users:write") ? (
          <Card title="Novo usuário">
            <UserForm assignmentOptions={assignmentOptions} />
          </Card>
        ) : null}
      </Columns>
    </>
  );
}
