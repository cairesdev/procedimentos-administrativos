import { listSystemAdmins } from "@/features/system-admin/queries";
import { SystemAdminsPanel } from "@/features/system-admin/components/SystemAdminsPanel";
import { Card, PageHeader } from "@/shared/ui/layout";

export default async function SystemAdminsPage() {
  const admins = await listSystemAdmins();

  return (
    <>
      <PageHeader
        title="Administradores do sistema"
        subtitle="Quem da sua equipe acessa este painel e todas as prefeituras"
      />

      <Card padded={false}>
        <div style={{ padding: "16px" }}>
          <SystemAdminsPanel admins={admins} />
        </div>
      </Card>
    </>
  );
}
