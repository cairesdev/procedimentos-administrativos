import Link from "next/link";
import { listChecklists, listChecklistTemplates } from "@/features/checklists/queries";
import { ChecklistWizard } from "@/features/checklists/components/ChecklistWizard";
import { listSectors } from "@/features/sectors/queries";
import { requirePermission } from "@/shared/auth/guards";
import { toDate } from "@/shared/ui/labels";
import { Alert, Badge, Card, PageHeader, Table } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { Pagination } from "@/shared/ui/Pagination";
import { TabNav } from "@/shared/ui/TabNav";

type PageProps = { searchParams: Promise<{ pagina?: string; aba?: string }> };

export default async function ChecklistsPage({ searchParams }: PageProps) {
  const viewer = await requirePermission("checklists:read", "CHECKLIST");
  const { pagina, aba } = await searchParams;

  // Duas abas, porque são dois trabalhos: o que ainda deve alguma coisa é
  // fila; o resto é histórico.
  const emAberto = aba !== "todos";

  const [checklists, abertos, modelos, setores] = await Promise.all([
    listChecklists({ pagina, emAberto }),
    listChecklists({ emAberto: true }),
    listChecklistTemplates().catch(() => []),
    listSectors().catch(() => []),
  ]);

  const podeCriar = viewer.can("checklists:manage");

  return (
    <>
      <PageHeader
        title="Checklists"
        subtitle="Exigências a cumprir, com prazo, anexo e conferência"
        action={
          podeCriar ? (
            <ModalTrigger
              label="Novo checklist"
              title="Novo checklist"
              description="De um modelo, ou escrito na hora."
            >
              <ChecklistWizard modelos={modelos.filter((m) => m.ativo)} setores={setores} />
            </ModalTrigger>
          ) : null
        }
      />

      <TabNav
        tabs={[
          {
            rotulo: "Com pendência",
            href: "/checklists",
            ativa: emAberto,
            contagem: abertos.total,
          },
          { rotulo: "Todos", href: "/checklists?aba=todos", ativa: !emAberto },
        ]}
      />

      {podeCriar && modelos.length === 0 ? (
        <Alert tone="info">
          Nenhum modelo cadastrado ainda. Um modelo é a lista escrita uma vez e aplicada muitas —
          vale a pena começar por ele se as mesmas exigências se repetem.
        </Alert>
      ) : null}

      <Card title={`${checklists.total} checklists`} padded={false}>
        <Table
          columns={["Checklist", "Referente a", "Itens", "Em aberto", "Criado em"]}
          isEmpty={checklists.itens.length === 0}
          emptyMessage={emAberto
            ? "Nenhum checklist com pendência — tudo em dia."
            : "Nenhum checklist ainda."}
        >
          {checklists.itens.map((checklist) => (
            <tr key={checklist.id}>
              <td>
                <Link href={`/checklists/${checklist.id}`}>
                  <strong>{checklist.titulo}</strong>
                </Link>
              </td>
              <td>
                {checklist.alvoTipo
                  ? <Badge tone="neutral">{checklist.alvoTipo.toLowerCase()}</Badge>
                  : <span style={{ color: "var(--texto_apagado)" }}>lista avulsa</span>}
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
        <Pagination
          info={checklists}
          base="/checklists"
          filtros={emAberto ? {} : { aba: "todos" }}
        />
      </Card>
    </>
  );
}
