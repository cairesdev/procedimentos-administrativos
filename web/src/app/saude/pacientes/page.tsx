import Link from "next/link";
import { searchPatients } from "@/features/health/queries";
import { PatientForm } from "@/features/health/components/PatientForm";
import { requirePermission } from "@/shared/auth/guards";
import { Pagination } from "@/shared/ui/Pagination";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { Card, EmptyState, PageHeader, Stack, Table } from "@/shared/ui/layout";

type PageProps = { searchParams: Promise<{ termo?: string; pagina?: string }> };

/**
 * O cadastro de pacientes.
 *
 * Um campo de busca só, que aceita nome, prontuário ou qualquer um dos cinco
 * documentos: a atendente tem a pessoa na frente e um papel na mão, e
 * obrigá-la a escolher o campo antes de digitar é uma pergunta a mais entre
 * ela e o atendimento.
 */
export default async function PacientesPage({ searchParams }: PageProps) {
  const viewer = await requirePermission("health:read", "SAUDE");
  const { termo, pagina } = await searchParams;

  const pacientes = await searchPatients(termo ?? "", pagina);

  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle="Quem já foi atendido — o prontuário acompanha a pessoa para sempre"
        action={
          viewer.can("health:admit") ? (
            <ModalTrigger
              label="Cadastrar paciente"
              title="Cadastrar paciente"
              description="Todos os documentos são opcionais. O atendimento não espera cadastro completo."
            >
              <PatientForm />
            </ModalTrigger>
          ) : null
        }
      />

      <Stack>
        <FilterBar ativo={Boolean(termo)} base="/saude/pacientes">
          <FilterField label="Buscar" htmlFor="termo" largo>
            <input
              id="termo"
              name="termo"
              defaultValue={termo}
              placeholder="Nome, nome da mãe, prontuário, CNS, CPF, NIS, CNH ou RG"
            />
          </FilterField>
        </FilterBar>

        <Card padded={false}>
          <Table
            columns={["Prontuário", "Nome", "Nome da mãe", "Nascimento", "Cartão do SUS", ""]}
            isEmpty={pacientes.itens.length === 0}
            emptyMessage="Nenhum paciente encontrado."
            empty={
              <EmptyState
                titulo={termo ? "Ninguém com esses dados" : "Nenhum paciente cadastrado ainda"}
                descricao={
                  termo
                    ? "Confira o que foi digitado. Se for a primeira visita da "
                      + "pessoa, cadastre — o prontuário é atribuído uma vez e "
                      + "ela o carrega para sempre."
                    : "O cadastro nasce no balcão, na primeira visita. Nome é o "
                      + "único campo obrigatório: documento entra quando houver."
                }
              />
            }
          >
            {pacientes.itens.map((paciente) => (
              <tr key={paciente.id}>
                <td>{paciente.prontuario}</td>
                <td>{paciente.nome}</td>
                <td>{paciente.nomeMae ?? "—"}</td>
                <td>{paciente.dataNascimento ? toDate(paciente.dataNascimento) : "—"}</td>
                <td>{paciente.cns ?? "—"}</td>
                <td>
                  <Link href={`/saude/pacientes/${paciente.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Pagination info={pacientes} base="/saude/pacientes" />
      </Stack>
    </>
  );
}
