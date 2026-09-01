import Link from "next/link";
import { listChecklistsOf } from "../queries";
import { Alert, Badge, Card, Table } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";

/**
 * Os checklists de um registro, onde ele mora.
 *
 * A trava é a de sempre: quem não tem o módulo recebe 403, e o card some em
 * vez de estourar a página inteira. Checklist é módulo contratável — nem toda
 * prefeitura terá.
 */
export const ChecklistCard = async ({
  alvoTipo,
  alvoId,
}: {
  alvoTipo: string;
  alvoId: string;
}) => {
  const checklists = await listChecklistsOf(alvoTipo, alvoId).catch(() => null);
  if (checklists === null || checklists.length === 0) return null;

  return (
    <Card title={`Checklists (${checklists.length})`} padded={false}>
      <Table
        columns={["Checklist", "Itens", "Em aberto", "Criado em"]}
        isEmpty={false}
        emptyMessage="Nenhum checklist."
      >
        {checklists.map((checklist) => (
          <tr key={checklist.id}>
            <td>
              <Link href={`/checklists/${checklist.id}`}>
                <strong>{checklist.titulo}</strong>
              </Link>
            </td>
            <td>{checklist.totalItens}</td>
            <td>
              {checklist.emAberto === 0
                ? <Badge tone="success">completo hoje</Badge>
                : <Badge tone="warning">{checklist.emAberto}</Badge>}
            </td>
            <td>{toDate(checklist.criadoEm)}</td>
          </tr>
        ))}
      </Table>

      {checklists.some((checklist) => checklist.emAberto > 0) ? (
        <div style={{ padding: "0 16px 14px" }}>
          <Alert tone="info">
            Item pendente não impede a tramitação — o checklist mostra o que falta, e quem despacha
            decide.
          </Alert>
        </div>
      ) : null}
    </Card>
  );
};
