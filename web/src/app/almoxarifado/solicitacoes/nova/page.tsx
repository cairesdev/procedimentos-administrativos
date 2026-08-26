import { getStockSettings, listStockLocations, listStockTypes } from "@/features/stock/queries";
import { RequestBuilder } from "@/features/stock/components/RequestBuilder";
import { requirePermission } from "@/shared/auth/guards";
import { PageHeader } from "@/shared/ui/layout";

export default async function NewStockRequestPage() {
  await requirePermission("stock:request", "ALMOXARIFADO");

  const [locais, tipos, config] = await Promise.all([
    listStockLocations(),
    listStockTypes(),
    getStockSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Novo pedido"
        subtitle="O disponível já desconta o que outros pedidos reservaram"
      />
      <RequestBuilder
        locais={locais}
        tipos={tipos}
        alertaValidadeDias={config.alertaValidadeDias}
      />
    </>
  );
}
