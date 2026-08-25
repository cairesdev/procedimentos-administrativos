import { listSubjects } from "@/features/protocol/queries";
import { SubjectForm } from "@/features/protocol/components/SubjectForm";
import { SubjectRowActions } from "@/features/protocol/components/SubjectRowActions";
import { listSectors } from "@/features/sectors/queries";
import { requirePermission } from "@/shared/auth/guards";
import { Alert, Badge, Card, PageHeader, Table } from "@/shared/ui/layout";
import { ModalTrigger } from "@/shared/ui/Modal";

export default async function SubjectsPage() {
  const viewer = await requirePermission("protocol:manage", "PROTOCOLO");
  const [assuntos, setores] = await Promise.all([listSubjects(), listSectors()]);

  return (
    <>
      <PageHeader
        title="Assuntos do protocolo"
        subtitle="O que esta prefeitura atende quando alguém de fora procura"
        action={
          <ModalTrigger label="Novo assunto" title="Novo assunto">
            <SubjectForm setores={setores} />
          </ModalTrigger>
        }
      />

      <div style={{ marginBottom: "14px" }}>
        <Alert tone="info">
          Cada assunto aponta o setor que resolve, e o atendimento nasce direto nele. Assunto que
          já tem atendimento não pode ser excluído — desative para parar de oferecê-lo sem apagar
          a classificação dos processos antigos.
        </Alert>
      </div>

      <Card title={`${assuntos.length} assuntos`} padded={false}>
        <Table
          columns={["Assunto", "Setor responsável", "Prazo", "Atendimentos", "Situação", ""]}
          isEmpty={assuntos.length === 0}
          emptyMessage="Nenhum assunto cadastrado — o balcão ainda não consegue abrir atendimento."
        >
          {assuntos.map((assunto) => (
            <tr key={assunto.id}>
              <td>
                <strong>{assunto.nome}</strong>
                {assunto.descricao ? (
                  <>
                    <br />
                    <small>{assunto.descricao}</small>
                  </>
                ) : null}
              </td>
              <td>{assunto.setorNome ?? "segue o fluxo"}</td>
              <td>{assunto.prazoDias ? `${assunto.prazoDias} dias` : "—"}</td>
              <td>{assunto.atendimentos}</td>
              <td>
                {assunto.ativo ? (
                  <Badge tone="success">oferecido</Badge>
                ) : (
                  <Badge tone="warning">desativado</Badge>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <SubjectRowActions
                  assunto={assunto}
                  setores={setores}
                  canWrite={viewer.can("protocol:manage")}
                />
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
