import { listAssetLocations } from "@/features/assets/queries";
import { AssetLocationForm } from "@/features/assets/components/AssetLocationForm";
import { AssetLocationTable } from "@/features/assets/components/AssetLocationTable";
import { listUnits } from "@/features/units/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Card, PageHeader } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function AssetLocationsPage() {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const [locations, units] = await Promise.all([listAssetLocations(), listUnits()]);

  const unitOptions = units.map((unit) => ({ value: unit.id, label: unit.nome }));
  const canWrite = viewer.can("assets:write");

  return (
    <>
      <PageHeader
        title="Locais"
        subtitle="Escolas, secretarias e prédios onde os bens ficam — o código do local abre o tombamento"
        action={
          canWrite ? (
            <ModalTrigger
              label="Novo local"
              title="Novo local"
              description="O código vira o prefixo do tombamento dos bens guardados aqui."
            >
              <AssetLocationForm units={unitOptions} />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${locations.length} cadastrados`} padded={false}>
        <AssetLocationTable locations={locations} units={unitOptions} canWrite={canWrite} />
      </Card>
    </>
  );
}
