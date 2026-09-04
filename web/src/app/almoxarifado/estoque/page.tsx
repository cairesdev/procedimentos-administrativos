import { getLocalStock, getStockSettings, listStockLocations } from "@/features/stock/queries";
import { LocalStockView } from "@/features/stock/components/LocalStockView";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";

type LocalStockPageProps = { searchParams: Promise<{ local?: string }> };

export default async function LocalStockPage({ searchParams }: LocalStockPageProps) {
  await requirePermission("stock:read", "ALMOXARIFADO");
  const { local } = await searchParams;

  const [locais, config] = await Promise.all([listStockLocations(), getStockSettings()]);
  const escolhido = local ?? locais[0]?.id;
  const estoque = escolhido ? await getLocalStock(escolhido) : [];

  return (
    <>
      <PageHeader
        title="Saldo por unidade"
        subtitle="O que cada escola tem no armário, lote a lote, com a validade de origem"
      />

      <FilterBar base="/almoxarifado/estoque" acao="Ver saldo">
        <FilterField label="Local" htmlFor="local">
          <select id="local" name="local" defaultValue={escolhido ?? ""}>
            {locais.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      {locais.length === 0 ? (
        <Alert tone="info">Nenhum local cadastrado ainda.</Alert>
      ) : (
        <Card title={`${estoque.length} produtos em estoque`} padded={false}>
          <LocalStockView estoque={estoque} alertaValidadeDias={config.alertaValidadeDias} />
        </Card>
      )}
    </>
  );
}
