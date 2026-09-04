import {
  getLocalStock, listQualityRecords, listStockLocations,
} from "@/features/stock/queries";
import { QualityForm } from "@/features/stock/components/QualityForm";
import { QUALITY_TYPES } from "@/features/stock/types";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Badge, Card, PageHeader, Table, numericCell } from "@/shared/ui/layout";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { toDateTime } from "@/shared/ui/labels";
import { ModalTrigger } from "@/shared/ui/Modal";

type PageProps = { searchParams: Promise<{ tipo?: string }> };

const rotuloDoTipo = (tipo: string) =>
  QUALITY_TYPES.find((item) => item.value === tipo)
  ?? { label: tipo.toLowerCase(), tone: "neutral" as const };

/**
 * Acompanhamento do material armazenado.
 *
 * A tela existe para quem observa: a escola que recebeu a caixa amassada e o
 * almoxarife que viu a câmara fria oscilar. Por isso pede só `stock:read` — e
 * por isso o registro não move saldo nenhum.
 */
export default async function QualityPage({ searchParams }: PageProps) {
  await requirePermission("stock:read", "ALMOXARIFADO");
  const { tipo } = await searchParams;

  const [registros, locais] = await Promise.all([
    listQualityRecords({ tipo }),
    listStockLocations(),
  ]);

  // O formulário oferece os lotes que a unidade já tem no armário — é sobre
  // eles que a escola observa alguma coisa.
  const primeiroLocal = locais[0]?.id;
  const estoqueDaUnidade = primeiroLocal
    ? await getLocalStock(primeiroLocal).catch(() => [])
    : [];

  return (
    <>
      <PageHeader
        title="Qualidade do material"
        subtitle="Danos, validade e acompanhamentos do que está armazenado"
        action={
          <ModalTrigger
            label="Registrar"
            title="Registrar observação"
            description="Acompanhamento do material armazenado — não altera o saldo."
          >
            <QualityForm estoqueDaUnidade={estoqueDaUnidade} />
          </ModalTrigger>
        }
      />

      <Alert tone="info">
        O registro é opcional e serve para acompanhar: caixa amassada, lote perto de vencer,
        câmara fria que oscilou. Ele <strong>não tira material do estoque</strong> — para isso
        existe o ajuste, que pede o saldo contado e o motivo.
      </Alert>

      <FilterBar base="/almoxarifado/qualidade" ativo={Boolean(tipo)}>
        <FilterField label="Tipo" htmlFor="tipo">
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""}>
            <option value="">Todos os tipos</option>
            {QUALITY_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Card title={`${registros.length} registros`} padded={false}>
        <Table
          columns={["Produto", "Onde está", "O que foi observado", "Qtd.", "Quem e quando"]}
          isEmpty={registros.length === 0}
          emptyMessage="Nenhum registro — ou nada foi observado, ou ninguém anotou ainda."
        >
          {registros.map((registro) => {
            const doTipo = rotuloDoTipo(registro.tipo);
            return (
              <tr key={registro.id}>
                <td>
                  <strong>{registro.produtoNome}</strong>
                  <br />
                  <small>{registro.unidadeMedida}</small>
                </td>
                <td>{registro.ondeEsta}</td>
                <td>
                  <Badge tone={doTipo.tone}>{doTipo.label}</Badge>
                  <br />
                  {registro.observacao}
                </td>
                <td className={numericCell}>
                  {/* Sem quantidade é o normal: nem toda observação tem uma. */}
                  {registro.quantidade === null ? "—" : registro.quantidade}
                </td>
                <td>
                  {registro.usuarioNome}
                  <br />
                  <small>{toDateTime(registro.data)}</small>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
