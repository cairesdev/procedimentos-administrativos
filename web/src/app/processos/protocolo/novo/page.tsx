import { listSubjects } from "@/features/protocol/queries";
import { ServiceForm } from "@/features/protocol/components/ServiceForm";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

export default async function NewServicePage() {
  await requirePermission("protocol:serve", "PROCESSOS");
  const assuntos = await listSubjects(true);

  return (
    <>
      <PageHeader
        title="Atendimento de balcão"
        subtitle="Abre protocolo para cidadão, fornecedor ou outro órgão"
      />
      <ServiceForm assuntos={assuntos} />
    </>
  );
}
