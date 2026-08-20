import { getUsageReport } from "@/features/fleet/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Card, PageHeader, SummaryGrid, Table, Toolbar, numericCell } from "@/shared/ui/layout";
import { toCurrency } from "@/shared/ui/labels";

type ReportPageProps = {
  searchParams: Promise<{ de?: string; ate?: string }>;
};

const soData = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;

const numero = (valor: number, casas = 0) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);

export default async function UsageReportPage({ searchParams }: ReportPageProps) {
  await requirePermission("fleet:read", "FROTAS");
  const { de, ate } = await searchParams;

  // Padrão: mês corrente.
  const hoje = new Date();
  const primeiroDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioTexto = de || soData(primeiroDoMes);
  const fimTexto = ate || soData(hoje);

  // O fim é exclusivo na API; somar um dia inclui o dia escolhido inteiro.
  const inicio = new Date(`${inicioTexto}T00:00:00`);
  const fim = new Date(`${fimTexto}T00:00:00`);
  fim.setDate(fim.getDate() + 1);

  const rows = await getUsageReport(inicio.toISOString(), fim.toISOString());

  const total = rows.reduce(
    (soma, linha) => ({
      viagens: soma.viagens + linha.viagensFinalizadas,
      km: soma.km + linha.kmRodado,
      litros: soma.litros + linha.litros,
      combustivel: soma.combustivel + linha.valorCombustivel,
      manutencao: soma.manutencao + linha.custoManutencao,
    }),
    { viagens: 0, km: 0, litros: 0, combustivel: 0, manutencao: 0 },
  );

  // Só faz sentido com os dois lados preenchidos no período.
  const consumoMedio = total.litros > 0 ? total.km / total.litros : null;

  return (
    <>
      <PageHeader
        title="Relatório de uso"
        subtitle="Quanto cada veículo rodou, gastou e ficou parado no período"
      />

      <form method="get">
        <Toolbar>
          <label style={{ fontSize: "13px" }}>
            De{" "}
            <input type="date" name="de" defaultValue={inicioTexto} style={{ marginLeft: "4px" }} />
          </label>
          <label style={{ fontSize: "13px" }}>
            Até{" "}
            <input type="date" name="ate" defaultValue={fimTexto} style={{ marginLeft: "4px" }} />
          </label>
          <Button type="submit" variant="secondary">
            Gerar
          </Button>
        </Toolbar>
      </form>

      <Card>
        <SummaryGrid
          items={[
            { label: "Viagens finalizadas", value: total.viagens },
            { label: "Km rodados", value: `${numero(total.km, 1)} km` },
            { label: "Combustível", value: toCurrency(total.combustivel) },
            { label: "Manutenção", value: toCurrency(total.manutencao) },
            {
              label: "Consumo médio",
              value: consumoMedio === null ? "—" : `${numero(consumoMedio, 1)} km/L`,
            },
          ]}
        />
      </Card>

      <Card title="Por veículo" padded={false}>
        <Table
          columns={["Veículo", "Viagens", "Km rodado", "Litros", "Combustível", "Manutenção"]}
          isEmpty={rows.length === 0}
          emptyMessage="Nenhum veículo cadastrado."
        >
          {rows.map((row) => (
            <tr key={row.veiculoId}>
              <td>
                <strong>{row.placa}</strong>
                <br />
                <small>{row.modelo}</small>
              </td>
              <td className={numericCell}>{row.viagensFinalizadas}</td>
              <td className={numericCell}>{numero(row.kmRodado, 1)}</td>
              <td className={numericCell}>{numero(row.litros, 2)}</td>
              <td className={numericCell}>{toCurrency(row.valorCombustivel)}</td>
              <td className={numericCell}>{toCurrency(row.custoManutencao)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <p style={{ fontSize: "12.5px", color: "var(--texto_suave)" }}>
        Km rodado e viagens contam pela data de <strong>finalização</strong>. Custo de manutenção
        conta pela data de <strong>abertura</strong>. Viagem em andamento no fim do período entra no
        relatório seguinte.
      </p>
    </>
  );
}
