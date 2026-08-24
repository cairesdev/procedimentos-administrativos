import { listAssetLocations, listAssetTransfers, listAssetWriteOffs } from "@/features/assets/queries";
import { TransferTable } from "@/features/assets/components/TransferTable";
import { WRITE_OFF_REASONS } from "@/features/assets/types";
import { requirePermission } from "@/shared/auth/guards";
import { Button } from "@/shared/ui/button";
import { Alert, Card, PageHeader, Table, Toolbar } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";

type TransfersPageProps = {
  searchParams: Promise<{ status?: string; local?: string }>;
};

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const { status, local } = await searchParams;

  const [transfers, locations, writeOffs] = await Promise.all([
    listAssetTransfers({ status, local }),
    listAssetLocations(),
    listAssetWriteOffs(),
  ]);

  const canWrite = viewer.can("assets:write");
  const pendentes = transfers.filter((transfer) => transfer.status === "PENDENTE");

  return (
    <>
      <PageHeader
        title="Transferências e baixas"
        subtitle="Bem só muda de local com aceite do destino; baixa tira do ativo sem apagar o histórico"
      />

      {pendentes.length > 0 ? (
        <Alert tone="info">
          {pendentes.length === 1
            ? "Uma transferência aguardando aceite."
            : `${pendentes.length} transferências aguardando aceite.`}{" "}
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

      <Card title={`${transfers.length} transferências`} padded={false}>
        <TransferTable transfers={transfers} canWrite={canWrite} />
      </Card>

      <Card title={`${writeOffs.length} baixas registradas`} padded={false}>
        <Table
          columns={["Bem", "Local", "Motivo", "Observação", "Quando"]}
          isEmpty={writeOffs.length === 0}
          emptyMessage="Nenhum bem baixado."
        >
          {writeOffs.map((writeOff) => (
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
      </Card>
    </>
  );
}
