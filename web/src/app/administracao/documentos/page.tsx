import Link from "next/link";
import { listScopes, listTemplates } from "@/features/documents/queries";
import { NewTemplateForm } from "@/features/documents/components/NewTemplateForm";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Badge, Card, PageHeader, Table } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDateTime } from "@/shared/ui/labels";

export default async function DocumentTemplatesPage() {
  await requirePermission("documents:template");
  const [modelos, escopos] = await Promise.all([listTemplates(), listScopes()]);

  return (
    <>
      <PageHeader
        title="Modelos de documento"
        subtitle="O texto de cada peça emitida pelos sistemas desta prefeitura"
        action={
          <ModalTrigger
            label="Novo documento"
            title="Novo documento"
            description="Uma peça própria desta prefeitura, além das que já vêm prontas."
          >
            <NewTemplateForm escopos={escopos} />
          </ModalTrigger>
        }
      />

      <div style={{ marginBottom: "14px" }}>
        <Alert tone="info">
          Todo modelo já vem pronto no padrão do sistema. Editar cria uma versão só desta
          prefeitura; enquanto ela existir, o padrão deixa de valer aqui — e é possível voltar
          atrás a qualquer momento. O timbre (brasão, cabeçalho e rodapé) vem da configuração da
          prefeitura e entra em todas as peças, sem precisar estar no modelo.
        </Alert>
      </div>

      <Card title={`${modelos.length} modelos`} padded={false}>
        <Table
          columns={["Documento", "Título impresso", "Origem", "Situação", "Atualizado"]}
          isEmpty={modelos.length === 0}
          emptyMessage="Nenhum modelo cadastrado."
        >
          {modelos.map((modelo) => (
            <tr key={modelo.tipo}>
              <td>
                <Link
                  href={`/administracao/documentos/${modelo.tipo}`}
                  style={{ color: "var(--acao)" }}
                >
                  {modelo.nome}
                </Link>
                <br />
                <small>{modelo.modulo.toLowerCase()}</small>
              </td>
              <td>{modelo.titulo}</td>
              <td>
                {modelo.personalizado ? (
                  <Badge tone="accent">criado aqui</Badge>
                ) : modelo.origem === "PREFEITURA" ? (
                  <Badge tone="accent">texto alterado</Badge>
                ) : (
                  <Badge tone="neutral">padrão do sistema</Badge>
                )}
              </td>
              <td>
                {modelo.ativo ? (
                  <Badge tone="success">em uso</Badge>
                ) : (
                  <Badge tone="warning">desativado</Badge>
                )}
              </td>
              <td>{toDateTime(modelo.atualizadoEm)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
