import { listSectors } from "@/features/sectors/queries";
import { listStockLocations } from "@/features/stock/queries";
import { listUnits } from "@/features/units/queries";
import { listUsers } from "@/features/users/queries";
import { UserForm } from "@/features/users/components/UserForm";
import { UserTable } from "@/features/users/components/UserTable";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function UsersPage() {
  const viewer = await requirePermission("users:read");
  const [users, units, sectors, escolas] = await Promise.all([
    listUsers(), listUnits(), listSectors(),
    // A escola só aparece se a prefeitura tem o almoxarifado. Sem o módulo, a
    // consulta responde 403 e a lista fica sem ela — que é o certo: não há
    // escola a que lotar alguém.
    listStockLocations().catch(() => []),
  ]);

  const assignmentOptions = [
    ...units.map((unit) => ({ value: `unidade:${unit.id}`, label: `Unidade · ${unit.nome}` })),
    ...sectors.map((sector) => ({ value: `setor:${sector.id}`, label: `Setor · ${sector.nome}` })),
    // Escola por último: é o destino mais específico, e o que trava mais.
    ...escolas.map((escola) => ({
      value: `escola:${escola.id}`, label: `Escola · ${escola.nome}`,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Servidores com acesso ao sistema desta prefeitura"
        action={
          viewer.can("users:write") ? (
            <ModalTrigger
              label="Novo usuário"
              title="Novo usuário"
              description="O papel define o nível de acesso; a lotação define em nome de quem ele atua."
            >
              <UserForm assignmentOptions={assignmentOptions} />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${users.length} cadastrados`} padded={false}>
        <UserTable
          users={users}
          canWrite={viewer.can("users:write")}
          assignmentOptions={assignmentOptions}
        />
      </Card>
    </>
  );
}
