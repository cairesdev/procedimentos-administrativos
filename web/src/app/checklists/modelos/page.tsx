import { listChecklistTemplates } from "@/features/checklists/queries";
import { listSectors } from "@/features/sectors/queries";
import { TemplateForm } from "@/features/checklists/components/TemplateForm";
import { TemplateActions } from "@/features/checklists/components/TemplateActions";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Badge, Card, PageHeader, Table } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function ChecklistTemplatesPage() {
  const viewer = await requirePermission("checklists:manage", "CHECKLIST");
  const [modelos, setores] = await Promise.all([
    listChecklistTemplates(),
    listSectors().catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title="Modelos de checklist"
        subtitle="A lista escrita uma vez, aplicada muitas"
        action={
          <ModalTrigger
            label="Novo modelo"
            title="Novo modelo"
            description="Os itens serão copiados a cada aplicação."
          >
            <TemplateForm setores={setores} />
          </ModalTrigger>
        }
      />

      <Alert tone="info">
        Aplicar um modelo <strong>copia</strong> os itens para o checklist. Editar o modelo depois
        não mexe no que já foi aplicado — a lista de ontem continua dizendo o que se exigiu ontem.
      </Alert>

      <Card title={`${modelos.length} modelos`} padded={false}>
        <Table
          columns={["Modelo", "Itens", "Situação", ""]}
          isEmpty={modelos.length === 0}
          emptyMessage="Nenhum modelo ainda. Comece pela lista que mais se repete."
        >
          {modelos.map((modelo) => (
            <tr key={modelo.id}>
              <td>
                <strong>{modelo.nome}</strong>
                {modelo.descricao ? (
                  <>
                    <br />
                    <small>{modelo.descricao}</small>
                  </>
                ) : null}
              </td>
              <td>{modelo.totalItens}</td>
              <td>
                <Badge tone={modelo.ativo ? "success" : "neutral"}>
                  {modelo.ativo ? "ativo" : "inativo"}
                </Badge>
              </td>
              <td>
                <TemplateActions
                  modelo={modelo}
                  setores={setores}
                  podeEditar={viewer.can("checklists:manage")}
                />
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
