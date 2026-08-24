import Link from "next/link";
import { listGlobalTemplates } from "@/features/system-admin/queries";
import { Alert, Badge, Card, PageHeader, Table } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";

/** Modelos padrão do produto: o que vale para quem não personalizou. */
export default async function GlobalTemplatesPage() {
  const modelos = await listGlobalTemplates();

  return (
    <>
      <PageHeader
        title="Modelos padrão"
        subtitle="O texto das peças que toda prefeitura recebe pronto"
      />

      <div style={{ marginBottom: "14px" }}>
        <Alert tone="info">
          Corrigir aqui alcança de uma vez todas as prefeituras que não têm versão própria. Quem
          personalizou o modelo continua com o texto dela — a correção não chega lá.
        </Alert>
      </div>

      <Card title={`${modelos.length} modelos`} padded={false}>
        <Table
          columns={["Documento", "Título impresso", "Módulo", "Situação", "Atualizado"]}
          isEmpty={modelos.length === 0}
          emptyMessage="Nenhum modelo padrão cadastrado."
        >
          {modelos.map((modelo) => (
            <tr key={modelo.tipo}>
              <td>
                <Link href={`/admin/modelos/${modelo.tipo}`} style={{ color: "var(--acao)" }}>
                  {modelo.nome}
                </Link>
              </td>
              <td>{modelo.titulo}</td>
              <td>{modelo.modulo.toLowerCase()}</td>
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
