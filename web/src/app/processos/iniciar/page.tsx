import { listAllBids } from "@/features/bids/queries";
import { ProcessStarter } from "@/features/onboarding/components/ProcessStarter";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

export default async function StartProcessPage() {
  await requirePermission("bids:write", "PROCESSOS");
  const [units, bids] = await Promise.all([listUnits(), listAllBids()]);

  return (
    <>
      <PageHeader
        title="Iniciar procedimento"
        subtitle="Cadastre a origem e, se quiser, já siga para o contrato"
      />
      <ProcessStarter units={units} bids={bids} />
    </>
  );
}
