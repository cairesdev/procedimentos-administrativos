import Link from "next/link";
import { listChecklistsOf, listChecklistTemplates } from "../queries";
import { listSectors } from "@/features/sectors/queries";
import { ModalTrigger } from "@/shared/ui/Modal";
import { ChecklistWizard } from "./ChecklistWizard";
import { Alert, Badge, Card, Table } from "@/shared/ui/layout";
import { toDate } from "@/shared/ui/labels";
import styles from "./Checklist.module.css";

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
  podeCriar,
}: {
  alvoTipo: string;
  alvoId: string;
  /** Quem administra vê o botão — e é por ele que o checklist deve nascer. */
  podeCriar?: boolean;
}) => {
  const checklists = await listChecklistsOf(alvoTipo, alvoId).catch(() => null);

  // `null` é 403: a prefeitura não contratou o módulo, e o card some.
  if (checklists === null) return null;

  const [modelos, setores] = podeCriar
    ? await Promise.all([
      listChecklistTemplates().catch(() => []),
      listSectors().catch(() => []),
    ])
    : [[], []];

  /**
   * O caminho principal: o checklist nasce **de dentro** do registro, já
   * vinculado. Antes, criá-lo exigia sair daqui, escolher o tipo e colar um
   * UUID — e ninguém faria isso.
   */
  const botao = podeCriar ? (
    <ModalTrigger
      label="Novo checklist"
      title="Novo checklist"
      description="Já vinculado a este registro."
    >
      <ChecklistWizard
        modelos={modelos.filter((modelo) => modelo.ativo)}
        setores={setores}
        alvo={{ tipo: alvoTipo, id: alvoId }}
      />
    </ModalTrigger>
  ) : null;

  if (checklists.length === 0) {
    // Sem checklist e sem permissão de criar, não há card nenhum a mostrar.
    if (!podeCriar) return null;
    return (
      <Card title="Checklists" action={botao}>
        <Alert tone="info">
          Nenhum checklist neste registro. Um modelo aplicado aqui já nasce vinculado.
        </Alert>
      </Card>
    );
  }

  return (
    <Card title={`Checklists (${checklists.length})`} padded={false} action={botao}>
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
        <div className={styles.painel_card}>
          <Alert tone="info">
            Item pendente não impede a tramitação — o checklist mostra o que falta, e quem despacha
            decide.
          </Alert>
        </div>
      ) : null}
    </Card>
  );
};
