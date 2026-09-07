import Link from "next/link";
import { findVisit } from "@/features/health/queries";
import { TriageForm } from "@/features/health/components/TriageForm";
import { PrescriptionForm } from "@/features/health/components/PrescriptionForm";
import {
  AdministrationForm, AssessmentForm, EvolutionForm, ExamRequestForm, ExamResultForm,
  OutcomeForm, ProcedureForm,
} from "@/features/health/components/ClinicalForms";
import { AmendButton, IdentifyPatientButton } from "@/features/health/components/VisitActions";
import { listDocumentsFor, listTemplates } from "@/features/documents/queries";
import { IssueDocumentPanel } from "@/features/documents/components/IssueDocumentPanel";
import { requirePermission } from "@/shared/auth/guards";
import { toDate, toDateTime } from "@/shared/ui/labels";
import {
  Alert, Badge, Card, PageHeader, Stack, SummaryGrid, Table, Toolbar,
} from "@/shared/ui/layout";
import {
  CONDUCT_LABELS, OUTCOME_LABELS, PROCEDURE_LABELS, ROUTE_LABELS,
} from "@/features/health/types";

type PageProps = { params: Promise<{ id: string }> };

const ou = (valor: string | number | null | undefined) =>
  valor === null || valor === undefined || valor === "" ? "—" : String(valor);

/**
 * A ficha, na ordem do papel.
 *
 * Identificação → triagem → serviço médico → exames → prescrição e horários →
 * evolução → procedimento → saída. A ordem não é estética: é o fluxo do
 * atendimento, e quem preenche segue a folha de cima para baixo.
 *
 * Cada bloco **só mostra o formulário para quem o assina**. O médico não vê o
 * campo da triagem, o técnico não vê o da prescrição. Esconder o que a pessoa
 * não pode fazer é metade do trabalho — a API recusa igual —, mas é a metade
 * que evita a tentativa.
 */
export default async function FichaPage({ params }: PageProps) {
  const viewer = await requirePermission("health:read", "SAUDE");
  const { id } = await params;
  const [ficha, modelos, emitidos] = await Promise.all([
    findVisit(id),
    listTemplates("SAUDE"),
    listDocumentsFor(id),
  ]);

  const { atendimento, paciente, triagem, avaliacao, desfecho } = ficha;
  const encerrado = atendimento.status === "ENCERRADO";

  const podeTriar = viewer.can("health:nursing");
  const podeAtender = viewer.can("health:medical");
  const podeMedicar = viewer.can("health:medicate");

  const alergias = (paciente?.condicoes ?? [])
    .filter((condicao) => condicao.tipo === "ALERGIA" && condicao.descricao)
    .map((condicao) => condicao.descricao!);

  const retificacoesDe = (tabela: string, registroId?: string) =>
    ficha.retificacoes.filter((retificacao) => (
      retificacao.tabelaOrigem === tabela
      && (!registroId || retificacao.registroId === registroId)
    ));

  return (
    <>
      <PageHeader
        title={`Atendimento ${atendimento.numero}`}
        subtitle={`${atendimento.unidadeSaudeNome} · aberto em ${toDateTime(atendimento.abertoEm)} por ${atendimento.abertoPor}`}
      />

      <Stack>
        {encerrado ? (
          <Alert tone="info">
            Este atendimento foi encerrado. Ainda é possível registrar resultado
            de exame e retificações — o resto pertence a um atendimento novo.
          </Alert>
        ) : null}

        {/* ---------- Identificação ---------- */}
        <Card
          title="Identificação do paciente"
          action={
            !paciente && viewer.can("health:admit") && !encerrado
              ? <IdentifyPatientButton visitaId={atendimento.id} />
              : null
          }
        >
          {paciente ? (
            <>
              <SummaryGrid
                items={[
                  { label: "Nome", value: paciente.nome },
                  { label: "Prontuário", value: String(paciente.prontuario) },
                  { label: "Nome da mãe", value: ou(paciente.nomeMae) },
                  {
                    label: "Nascimento",
                    value: paciente.dataNascimento ? toDate(paciente.dataNascimento) : "—",
                  },
                  { label: "Cartão do SUS", value: ou(paciente.cns) },
                  { label: "Telefone", value: ou(paciente.telefone) },
                  {
                    label: "Endereço",
                    value: `${ou(paciente.endereco)} · ${ou(paciente.cidade)}/${ou(paciente.uf)}`,
                  },
                ]}
              />
              <Toolbar>
                {viewer.can("health:records") ? (
                  <Link href={`/saude/pacientes/${paciente.id}`}>
                    Ver cadastro e histórico
                  </Link>
                ) : null}
              </Toolbar>
              {alergias.length > 0 ? (
                <Alert tone="error">
                  <strong>Alergias registradas:</strong> {alergias.join("; ")}
                </Alert>
              ) : null}
            </>
          ) : (
            <Alert tone="error">
              <strong>Paciente ainda não identificado.</strong> A ficha abriu sem
              documento — é o caso de quem chega inconsciente ou sem acompanhante.
              A saída do paciente não pode ser registrada enquanto isso não for
              completado: ficha sem paciente é ficha que ninguém acha depois.
            </Alert>
          )}
        </Card>

        {/* ---------- Triagem ---------- */}
        <Card title="Triagem de enfermagem">
          {triagem ? (
            <>
              <SummaryGrid
                items={[
                  { label: "Glicemia", value: `${ou(triagem.glicemia)} mg/dL` },
                  {
                    label: "PA",
                    value: triagem.paSistolica && triagem.paDiastolica
                      ? `${triagem.paSistolica} × ${triagem.paDiastolica} mmHg`
                      : "—",
                  },
                  { label: "Pulso", value: `${ou(triagem.pulso)} bpm` },
                  { label: "Saturação", value: `${ou(triagem.saturacao)} %` },
                  { label: "Temperatura", value: `${ou(triagem.temperatura)} °C` },
                  {
                    label: "Conduta",
                    value: triagem.conduta
                      ? CONDUCT_LABELS[triagem.conduta] ?? triagem.conduta
                      : "—",
                  },
                  { label: "Prioridade", value: triagem.prioridade ? "SIM" : "não" },
                ]}
              />
              <p><strong>Queixa clínica:</strong> {ou(triagem.queixa)}</p>
              <p style={{ color: "var(--texto_suave)" }}>
                <small>
                  Assinado por {ou(triagem.fechadoPor)}
                  {triagem.fechadoEm ? ` em ${toDateTime(triagem.fechadoEm)}` : ""}
                </small>
              </p>
              <Toolbar>
                <AmendButton
                  visitaId={atendimento.id}
                  tabelaOrigem="triagem"
                  registroId={atendimento.id}
                  rotulo="Triagem de enfermagem"
                />
              </Toolbar>
              {retificacoesDe("triagem").map((retificacao) => (
                <Alert key={retificacao.id} tone="info">
                  <strong>Retificação</strong> ({toDateTime(retificacao.criadoEm)},{" "}
                  {retificacao.autor}): {retificacao.texto}
                </Alert>
              ))}
            </>
          ) : podeTriar && !encerrado ? (
            <TriageForm visitaId={atendimento.id} />
          ) : (
            <p style={{ color: "var(--texto_suave)" }}>
              Ainda sem triagem. É ato privativo do enfermeiro — no plantão sem
              enfermeiro ela fica em branco, e os sinais vitais entram na
              avaliação médica.
            </p>
          )}
        </Card>

        {/* ---------- Serviço médico ---------- */}
        <Card title="Serviço médico">
          {avaliacao ? (
            <>
              <p style={{ whiteSpace: "pre-wrap" }}>{avaliacao.queixaClinica}</p>
              <p style={{ color: "var(--texto_suave)" }}>
                <small>
                  Assinado por {ou(avaliacao.fechadoPor)}
                  {avaliacao.fechadoEm ? ` em ${toDateTime(avaliacao.fechadoEm)}` : ""}
                </small>
              </p>
              <Toolbar>
                <AmendButton
                  visitaId={atendimento.id}
                  tabelaOrigem="avaliacao_medica"
                  registroId={atendimento.id}
                  rotulo="Avaliação médica"
                />
              </Toolbar>
              {retificacoesDe("avaliacao_medica").map((retificacao) => (
                <Alert key={retificacao.id} tone="info">
                  <strong>Retificação</strong> ({toDateTime(retificacao.criadoEm)},{" "}
                  {retificacao.autor}): {retificacao.texto}
                </Alert>
              ))}
            </>
          ) : podeAtender && !encerrado ? (
            <AssessmentForm visitaId={atendimento.id} />
          ) : (
            <p style={{ color: "var(--texto_suave)" }}>Ainda sem avaliação médica.</p>
          )}
        </Card>

        {/* ---------- Exames ---------- */}
        <Card title="Exames solicitados e resultados">
          <Table
            columns={["Exame", "Resultado", "Solicitado por", ""]}
            isEmpty={ficha.exames.length === 0}
            emptyMessage="Nenhum exame solicitado."
          >
            {ficha.exames.map((exame) => (
              <tr key={exame.id}>
                <td>{exame.descricao}</td>
                <td>
                  {exame.resultado ?? <em>aguardando</em>}
                  {exame.resultadoPor ? (
                    <>
                      <br />
                      <small style={{ color: "var(--texto_suave)" }}>
                        registrado por {exame.resultadoPor}
                      </small>
                    </>
                  ) : null}
                </td>
                <td>
                  {exame.solicitadoPor}
                  <br />
                  <small style={{ color: "var(--texto_suave)" }}>
                    {toDateTime(exame.solicitadoEm)}
                  </small>
                </td>
                <td>
                  {/*
                    O resultado entra mesmo depois da alta: o laboratório
                    devolve dias depois, e quem transcreve é quem está de
                    plantão — enfermeiro ou médico.
                  */}
                  {!exame.resultado && (podeTriar || podeAtender) ? (
                    <ExamResultForm visitaId={atendimento.id} exameId={exame.id} />
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
          {podeAtender && !encerrado ? (
            <ExamRequestForm visitaId={atendimento.id} />
          ) : null}
        </Card>

        {/* ---------- Prescrição e horários ---------- */}
        <Card title="Prescrição médica e horários da enfermagem">
          {ficha.prescricoes.map((prescricao) => (
            <div key={prescricao.id} style={{ marginBottom: "20px" }}>
              <Table
                columns={["Medicamento", "Dose", "Via", "Frequência", "Horários", ""]}
                isEmpty={prescricao.itens.length === 0}
                emptyMessage="Só orientações, sem medicamento."
              >
                {prescricao.itens.map((item) => (
                  <tr key={item.id}>
                    <td>{item.medicamento}</td>
                    <td>{item.dose}</td>
                    <td>{ROUTE_LABELS[item.via] ?? item.via}</td>
                    <td>{item.frequencia}</td>
                    <td>
                      {item.administracoes.length === 0
                        ? <em>não administrado</em>
                        : item.administracoes.map((administracao) => (
                          <div key={administracao.id}>
                            {toDateTime(administracao.horario)}
                            <br />
                            <small style={{ color: "var(--texto_suave)" }}>
                              {administracao.executadoPor}
                            </small>
                          </div>
                        ))}
                    </td>
                    <td>
                      {podeMedicar ? (
                        <AdministrationForm
                          visitaId={atendimento.id}
                          itemId={item.id}
                          medicamento={item.medicamento}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </Table>
              {prescricao.orientacoes ? (
                <p><strong>Orientações:</strong> {prescricao.orientacoes}</p>
              ) : null}
              <p style={{ color: "var(--texto_suave)" }}>
                <small>
                  Assinada por {ou(prescricao.fechadoPor)}
                  {prescricao.fechadoEm ? ` em ${toDateTime(prescricao.fechadoEm)}` : ""}
                </small>
              </p>
            </div>
          ))}

          {podeAtender && !encerrado ? (
            <PrescriptionForm visitaId={atendimento.id} alergias={alergias} />
          ) : null}
        </Card>

        {/* ---------- Evolução ---------- */}
        <Card title="Evolução">
          <Table
            columns={["Quando", "Tipo", "Registro", "Autor"]}
            isEmpty={ficha.evolucoes.length === 0}
            emptyMessage="Nenhuma evolução registrada."
          >
            {ficha.evolucoes.map((evolucao) => (
              <tr key={evolucao.id}>
                <td>{toDateTime(evolucao.fechadoEm)}</td>
                <td>
                  <Badge tone={evolucao.tipo === "MEDICA" ? "accent" : "success"}>
                    {evolucao.tipo === "MEDICA" ? "médica" : "enfermagem"}
                  </Badge>
                </td>
                <td style={{ whiteSpace: "pre-wrap" }}>{evolucao.texto}</td>
                <td>{evolucao.autor}</td>
              </tr>
            ))}
          </Table>

          {!encerrado && podeTriar ? (
            <EvolutionForm visitaId={atendimento.id} tipo="ENFERMAGEM" />
          ) : null}
          {!encerrado && podeAtender ? (
            <EvolutionForm visitaId={atendimento.id} tipo="MEDICA" />
          ) : null}
        </Card>

        {/* ---------- Procedimento ---------- */}
        <Card title="Procedimento realizado">
          <Table
            columns={["Quando", "Procedimento", "Descrição", "Executado por"]}
            isEmpty={ficha.procedimentos.length === 0}
            emptyMessage="Nenhum procedimento registrado."
          >
            {ficha.procedimentos.map((procedimento) => (
              <tr key={procedimento.id}>
                <td>{toDateTime(procedimento.executadoEm)}</td>
                <td>{PROCEDURE_LABELS[procedimento.tipo] ?? procedimento.tipo}</td>
                <td>{ou(procedimento.descricao)}</td>
                <td>{procedimento.autor}</td>
              </tr>
            ))}
          </Table>
          {podeAtender && !encerrado ? <ProcedureForm visitaId={atendimento.id} /> : null}
        </Card>

        {/* ---------- Saída ---------- */}
        <Card title="Resumo de saída do paciente">
          {desfecho ? (
            <>
              <SummaryGrid
                items={[
                  { label: "Situação", value: OUTCOME_LABELS[desfecho.tipo] ?? desfecho.tipo },
                  { label: "Destino", value: ou(desfecho.destino) },
                  { label: "Horário", value: toDateTime(desfecho.horario) },
                  { label: "Assinado por", value: desfecho.fechadoPor },
                ]}
              />
              <Toolbar>
                <AmendButton
                  visitaId={atendimento.id}
                  tabelaOrigem="desfecho"
                  registroId={atendimento.id}
                  rotulo="Resumo de saída"
                />
              </Toolbar>
            </>
          ) : podeTriar ? (
            <OutcomeForm visitaId={atendimento.id} />
          ) : (
            <p style={{ color: "var(--texto_suave)" }}>
              O paciente ainda está em atendimento. A saída é registrada e
              assinada pelo enfermeiro.
            </p>
          )}
        </Card>

        {/* ---------- Retificações ---------- */}
        {ficha.retificacoes.length > 0 ? (
          <Card title="Retificações">
            {/*
              As rasuras ficam também num quadro só, no fim, além de aparecerem
              ao lado do bloco que corrigem. É como a controladoria vai querer
              lê-las: de uma vez, para saber o que foi corrigido nesta ficha.
            */}
            <Table
              columns={["Quando", "Sobre", "Correção", "Autor"]}
              isEmpty={false}
              emptyMessage=""
            >
              {ficha.retificacoes.map((retificacao) => (
                <tr key={retificacao.id}>
                  <td>{toDateTime(retificacao.criadoEm)}</td>
                  <td>{retificacao.tabelaOrigem.replace(/_/g, " ")}</td>
                  <td>{retificacao.texto}</td>
                  <td>{retificacao.autor}</td>
                </tr>
              ))}
            </Table>
          </Card>
        ) : null}

        {/*
          A ficha impressa é a contingência assumida desta fatia.
          ------------------------------------------------------------------
          O hospital continua imprimindo: para a pasta física durante a
          transição, para o paciente que pede, e para quando faltar energia —
          que num plantão de 24 horas não é hipótese. A peça reproduz as duas
          folhas do papel, com o carimbo de quem assinou cada bloco.
        */}
        <Card title="Ficha impressa">
          <IssueDocumentPanel
            referenciaId={atendimento.id}
            voltarPara={`/saude/atendimentos/${atendimento.id}`}
            modelos={modelos.filter((modelo) => modelo.escopo === "FICHA_ATENDIMENTO")}
            emitidos={emitidos}
            podeEmitir={viewer.can("documents:issue")}
          />
        </Card>
      </Stack>
    </>
  );
}
