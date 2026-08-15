import Link from "next/link";
import { listAssetLocations, listInventories } from "@/features/assets/queries";
import { InventoryForm } from "@/features/assets/components/InventoryForm";
import { requirePermission } from "@/shared/auth/guards";
import { Badge, Card, PageHeader, Table, numericCell } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function InventoriesPage() {
  const viewer = await requirePermission("assets:read", "PATRIMONIO");
  const [inventories, locations] = await Promise.all([listInventories(), listAssetLocations()]);

  return (
    <>
      <PageHeader
        title="Inventários"
        subtitle="Conferência periódica dos bens local por local"
        action={
          viewer.can("assets:write") ? (
            <ModalTrigger
              label="Abrir inventário"
              title="Abrir inventário"
              description="A lista de bens é montada a partir do que está tombado no local hoje."
            >
              <InventoryForm locations={locations} />
            </ModalTrigger>
          ) : null
        }
      />

      <Card title={`${inventories.length} registrados`} padded={false}>
        <Table
          columns={["Local", "Início", "Conclusão", "Conferidos", "Divergências", "Situação"]}
          isEmpty={inventories.length === 0}
          emptyMessage="Nenhum inventário aberto."
        >
          {inventories.map((inventory) => (
            <tr key={inventory.id}>
              <td>
                <Link href={`/patrimonio/inventarios/${inventory.id}`}>{inventory.localNome}</Link>
              </td>
              <td>{toDate(inventory.dataInicio)}</td>
              <td>{inventory.dataConclusao ? toDate(inventory.dataConclusao) : "—"}</td>
              <td className={numericCell}>
                {inventory.conferidos}/{inventory.esperados}
              </td>
              <td className={numericCell}>{inventory.divergencias}</td>
              <td>
                <Badge tone={inventory.status === "ABERTO" ? "warning" : "success"}>
                  {inventory.status === "ABERTO" ? "aberto" : "concluído"}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
