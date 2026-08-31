import { listStockLocations, listWarehouses } from "@/features/stock/queries";
import { StockLocationTable } from "@/features/stock/components/StockLocationTable";
import { requirePermission } from "@/shared/auth/guards";
import { StockPlaceForm } from "@/features/stock/components/StockPlaceForm";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";

export default async function StockLocationsPage() {
  const viewer = await requirePermission("stock:manage", "ALMOXARIFADO");
  const [locations, warehouses] = await Promise.all([
    listStockLocations({ inativos: true }),
    listWarehouses(),
  ]);

  const semAlmoxarifado = locations.filter((item) => !item.almoxarifadoId).length;

  return (
    <>
      <PageHeader
        title="Locais atendidos"
        subtitle="Escolas e postos que recebem material"
        action={
          <ModalTrigger
            label="Cadastrar local"
            title="Novo local atendido"
            description="Nome, código e de qual almoxarifado ele recebe."
          >
            <StockPlaceForm warehouses={warehouses} />
          </ModalTrigger>
        }
      />

      <Alert tone="info">
        É o mesmo cadastro do patrimônio — o prédio guarda bem tombado e estoque. Cadastrar
        aqui não exige ter o módulo de patrimônio contratado.
      </Alert>

      {semAlmoxarifado > 0 ? (
        <Alert tone="info">
          {semAlmoxarifado === 1
            ? "Um local ainda não está vinculado a um almoxarifado"
            : `${semAlmoxarifado} locais ainda não estão vinculados a um almoxarifado`}
          . Sem o vínculo, eles não conseguem enviar pedido.
        </Alert>
      ) : null}

      <Card title={`${locations.length} locais`} padded={false}>
        <StockLocationTable
          locations={locations}
          warehouses={warehouses}
          canWrite={viewer.can("stock:manage")}
        />
      </Card>
    </>
  );
}
