import { listDrivers } from "@/features/fleet/queries";
import { DriverForm } from "@/features/fleet/components/DriverForm";
import { DriverTable } from "@/features/fleet/components/DriverTable";
import { listUsers } from "@/features/users/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function DriversPage() {
  const viewer = await requirePermission("fleet:read", "FROTAS");
  const [drivers, users] = await Promise.all([listDrivers(), listUsers()]);

  const userOptions = users.map((user) => ({ value: user.id, label: user.nome }));
  const canWrite = viewer.can("fleet:write");
  const vencendo = drivers.filter(
    (driver) => driver.ativo && driver.diasParaVencerCnh <= 30,
  );

  return (
    <>
      <PageHeader
        title="Motoristas"
        subtitle="Quem pode dirigir, com controle de validade da CNH"
        action={
          canWrite ? (
            <ModalTrigger label="Novo motorista" title="Novo motorista">
              <DriverForm users={userOptions} />
            </ModalTrigger>
          ) : null
        }
      />

      {vencendo.length > 0 ? (
        <Alert tone="error">
          {vencendo.length === 1
            ? `A CNH de ${vencendo[0]!.nome} precisa de atenção.`
            : `${vencendo.length} motoristas com CNH vencida ou vencendo em até 30 dias.`}{" "}
          Motorista com CNH vencida não pode ser escalado.
        </Alert>
      ) : null}

      <Card title={`${drivers.length} cadastrados`} padded={false}>
        <DriverTable drivers={drivers} users={userOptions} canWrite={canWrite} />
      </Card>
    </>
  );
}
