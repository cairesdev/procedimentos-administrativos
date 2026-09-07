import Link from "next/link";
import { findPatient, listPatientHistory } from "@/features/health/queries";
import { PatientForm } from "@/features/health/components/PatientForm";
import { ConditionsPanel } from "@/features/health/components/ConditionsPanel";
import { requirePermission } from "@/shared/auth/guards";
import { ModalTrigger } from "@/shared/ui/Modal";
import { toDate, toDateTime } from "@/shared/ui/labels";
import {
  Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table,
} from "@/shared/ui/layout";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ completo?: string }>;
};

const ou = (valor: string | null | undefined) => valor?.trim() || "—";

/**
 * O cadastro e o histórico de um paciente.
 *
 * **Abrir o histórico entra na auditoria.** É a única leitura do sistema que
 * fica registrada, e é a contrapartida de deixá-lo aberto a todo profissional
 * clínico: continuidade do cuidado depende de ver a visita anterior, e a
 * trilha é o que inibe a curiosidade sobre a ficha do vizinho.
 *
 * Por isso a página só busca o histórico de quem tem `health:records` — a
 * recepção vê o cadastro e não vê o passado clínico.
 */
export default async function PacientePage({ params, searchParams }: PageProps) {
  const viewer = await requirePermission("health:read", "SAUDE");
  const { id } = await params;
  const { completo } = await searchParams;

  const paciente = await findPatient(id);
  const podeVerHistorico = viewer.can("health:records");
  const historico = podeVerHistorico
    ? await listPatientHistory(id, completo === "true")
    : [];

  return (
    <>
      <PageHeader
        title={paciente.nome}
        subtitle={`Prontuário ${paciente.prontuario}`}
        action={
          viewer.can("health:admit") ? (
            <ModalTrigger label="Editar cadastro" title="Editar cadastro">
              <PatientForm paciente={paciente} />
            </ModalTrigger>
          ) : null
        }
      />

      <Stack>
        <Card title="Cadastro">
          <SummaryGrid
            items={[
              { label: "Nome da mãe", value: ou(paciente.nomeMae) },
              {
                label: "Nascimento",
                value: paciente.dataNascimento ? toDate(paciente.dataNascimento) : "—",
              },
              { label: "Cartão do SUS", value: ou(paciente.cns) },
              { label: "CPF", value: ou(paciente.cpf) },
              { label: "NIS", value: ou(paciente.nis) },
              { label: "CNH", value: ou(paciente.cnh) },
              { label: "RG", value: ou(paciente.rg) },
              { label: "Telefone", value: ou(paciente.telefone) },
              {
                label: "Endereço",
                value: `${ou(paciente.endereco)} · ${ou(paciente.cidade)}/${ou(paciente.uf)}`,
              },
            ]}
          />
        </Card>

        <Card title="Condições e alergias">
          {/*
            Persiste no paciente, e não na visita. No papel esta linha é
            reescrita a cada atendimento e some quando alguém esquece; aqui é o
            que faz o alerta aparecer antes da prescrição da próxima vez.
          */}
          <ConditionsPanel
            pacienteId={paciente.id}
            condicoes={paciente.condicoes}
            podeEditar={viewer.can("health:nursing")}
          />
        </Card>

        <Card
          title="Histórico de atendimentos"
          action={
            podeVerHistorico ? (
              <Link
                href={`/saude/pacientes/${id}${completo === "true" ? "" : "?completo=true"}`}
              >
                {completo === "true" ? "Ver só os últimos 12 meses" : "Ver o histórico completo"}
              </Link>
            ) : null
          }
        >
          {!podeVerHistorico ? (
            <Alert tone="info">
              O histórico clínico é aberto a médicos e enfermeiros. O seu perfil
              alcança o cadastro do paciente, e não as visitas anteriores.
            </Alert>
          ) : (
            <>
              {completo !== "true" ? (
                <p style={{ color: "var(--texto_suave)" }}>
                  <small>
                    Mostrando os últimos doze meses. Nada foi apagado — o
                    prontuário é guardado por vinte anos, e o histórico completo
                    está a um clique.
                  </small>
                </p>
              ) : null}

              <Table
                columns={["Quando", "Nº", "Unidade", "Andamento", ""]}
                isEmpty={historico.length === 0}
                emptyMessage="Nenhum atendimento neste período."
              >
                {historico.map((visita) => (
                  <tr key={visita.id}>
                    <td>{toDateTime(visita.abertoEm)}</td>
                    <td>{visita.numero}</td>
                    <td>{visita.unidadeSaudeNome}</td>
                    <td>
                      {visita.prioridade ? <Badge tone="warning">prioridade</Badge> : null}{" "}
                      {visita.desfechoTipo
                        ? <Badge tone="accent">{visita.desfechoTipo.toLowerCase()}</Badge>
                        : <Badge tone="warning">em andamento</Badge>}
                    </td>
                    <td>
                      <Link href={`/saude/atendimentos/${visita.id}`}>Abrir ficha</Link>
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </Card>
      </Stack>
    </>
  );
}
