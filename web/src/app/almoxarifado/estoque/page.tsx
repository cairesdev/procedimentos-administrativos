import { getLocalStock, getStockSettings, listStockLocations } from "@/features/stock/queries";
import { LocalStockView } from "@/features/stock/components/LocalStockView";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Card, PageHeader, Toolbar } from "@/shared/ui/layout";
import { Button } from "@/shared/ui/button";

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

      <form method="get">
        <Toolbar>
          <select name="local" defaultValue={escolhido ?? ""} aria-label="Local">
            {locais.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Ver saldo
          </Button>
        </Toolbar>
      </form>

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
