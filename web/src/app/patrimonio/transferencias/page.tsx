import { listAssetLocations, listAssetTransfers, listAssetWriteOffs } from "@/features/assets/queries";
import { TransferTable } from "@/features/assets/components/TransferTable";
import { WRITE_OFF_REASONS } from "@/features/assets/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Table, Toolbar } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import { Pagination } from "@/shared/ui/Pagination";

type TransfersPageProps = {
  searchParams: Promise<{
    status?: string;
    local?: string;
    pagina?: string;
    paginaBaixas?: string;
  }>;
};

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const { status, local, pagina, paginaBaixas } = await searchParams;

  const [transfers, locations, writeOffs, aguardando] = await Promise.all([
    listAssetTransfers({ status, local, pagina }),
    listAssetLocations(),
    listAssetWriteOffs(paginaBaixas),
    // Consulta só pelo total: o aviso fala de todas as pendentes, não das que
    // por acaso caíram nesta página.
    listAssetTransfers({ status: "PENDENTE" }),
  ]);

  const canWrite = viewer.can("assets:write");
  const pendentes = aguardando.total;

  return (
    <>
      <PageHeader
        title="Transferências e baixas"
        subtitle="Bem só muda de local com aceite do destino; baixa tira do ativo sem apagar o histórico"
      />

      {pendentes > 0 ? (
        <Alert tone="info">
          {pendentes === 1
            ? "Uma transferência aguardando aceite."
            : `${pendentes} transferências aguardando aceite.`}{" "}
          Até o aceite, o bem continua contando no local de origem.
        </Alert>
      ) : null}

      {/* Formulário GET: o filtro fica na URL e sobrevive ao recarregar. */}
      <form method="get">
        <Toolbar>
          <select name="status" defaultValue={status ?? ""} aria-label="Situação">
            <option value="">Todas as situações</option>
            <option value="PENDENTE">Aguardando aceite</option>
            <option value="ACEITA">Aceitas</option>
            <option value="RECUSADA">Recusadas</option>
          </select>

          <select name="local" defaultValue={local ?? ""} aria-label="Local">
            <option value="">Todos os locais</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.codigo} · {location.nome}
              </option>
            ))}
          </select>

          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </Toolbar>
      </form>

      <Card title={`${transfers.total} transferências`} padded={false}>
        <TransferTable transfers={transfers.itens} canWrite={canWrite} />
        <Pagination
          info={transfers}
          base="/patrimonio/transferencias"
          filtros={{ status, local, paginaBaixas }}
        />
      </Card>

      <Card title={`${writeOffs.total} baixas registradas`} padded={false}>
        <Table
          columns={["Bem", "Local", "Motivo", "Observação", "Quando"]}
          isEmpty={writeOffs.itens.length === 0}
          emptyMessage="Nenhum bem baixado."
        >
          {writeOffs.itens.map((writeOff) => (
            <tr key={writeOff.bemId}>
              <td>
                <strong>{writeOff.codigoTombamento}</strong>
                <br />
                <small>{writeOff.nomeBem}</small>
              </td>
              <td>{writeOff.localNome}</td>
              <td>
                {WRITE_OFF_REASONS.find((reason) => reason.value === writeOff.motivo)?.label ??
                  writeOff.motivo}
              </td>
              <td>{writeOff.observacao ?? "—"}</td>
              <td>
                {toDateTime(writeOff.data)}
                <br />
                <small>por {writeOff.dadaPor}</small>
              </td>
            </tr>
          ))}
        </Table>

        {/* Duas listas na mesma tela: cada uma com seu parâmetro de página. */}
        <Pagination
          info={writeOffs}
          base="/patrimonio/transferencias"
          filtros={{ status, local, pagina }}
          param="paginaBaixas"
        />
      </Card>
    </>
  );
}
