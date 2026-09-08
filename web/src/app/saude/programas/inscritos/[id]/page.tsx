import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  findEnrolled,
  listPrograms,
  listSessions,
} from "@/features/programs/queries";
import {
  ChangeStatusButton,
  CompletePersonButton,
} from "@/features/programs/components/EnrollmentActions";
import {
  EndTherapyButton,
  IndicateButton,
  SessionButton,
  StartTherapyButton,
} from "@/features/programs/components/TherapyActions";
import { SITUACAO_ROTULO } from "@/features/programs/types";
import { ApiError } from "@/shared/api/http-client";
import { requirePermission } from "@/shared/auth/guards";
import { toDate } from "@/shared/ui/labels";
import {
  Alert,
  Badge,
  Card,
  PageHeader,
  Stack,
  SummaryGrid,
  Table,
  Toolbar,
  numericCell,
} from "@/shared/ui/layout";

type Props = { params: Promise<{ id: string }> };

const diasDesde = (data: string) =>
  Math.max(
    Math.round(
      (Date.now() - new Date(`${data}T00:00:00`).getTime()) / 86_400_000,
    ),
    0,
  );

/**
 * A ficha de quem está no programa: a situação e a fila dela.
 *
 * A espera aparece por terapia, com o número de dias em vermelho quando a
 * terapia ainda não começou. É o mesmo número que vai para o relatório, e é
 * deliberado que ele fique visível aqui: quem coordena tem que ver a fila
 * crescer antes de o promotor perguntar por ela.
 */
export default async function InscritoPage({ params }: Props) {
  const viewer = await requirePermission("programs:read", "SAUDE");
  const { id } = await params;

  const ficha = await findEnrolled(id).catch((erro) => {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  });
  if (!ficha?.inscricao?.id) notFound();

  const { inscricao, indicacoes } = ficha;

  const programas = await listPrograms().catch(() => []);
  const programa = programas.find(
    (item) => item.nome === inscricao.programaNome,
  );

  const jaIndicadas = new Set(
    indicacoes
      .filter((indicacao) => !indicacao.encerradaEm)
      .map((i) => i.terapiaId),
  );
  const disponiveis = (programa?.terapias ?? []).filter(
    (terapia) => terapia.ativo && !jaIndicadas.has(terapia.id),
  );

  // A sessão mais recente de cada terapia em andamento, para a coordenação
  // enxergar sem abrir uma tela por indicação.
  const emAndamento = indicacoes.filter(
    (indicacao) => indicacao.iniciadaEm && !indicacao.encerradaEm,
  );
  const sessoes = await Promise.all(
    emAndamento.map((indicacao) =>
      listSessions(indicacao.id)
        .then((lista) => ({ indicacao, lista }))
        .catch(() => ({ indicacao, lista: [] })),
    ),
  );

  const naFila = indicacoes.filter(
    (indicacao) => !indicacao.iniciadaEm && !indicacao.encerradaEm,
  );

  return (
    <>
      <p style={{ marginBottom: "10px" }}>
        <Link
          href="/saude/programas"
          style={{
            color: "var(--texto_suave)",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Inscritos
        </Link>
      </p>

      <PageHeader
        title={inscricao.nome}
        subtitle={`${inscricao.programaNome} · prontuário ${inscricao.prontuario}`}
        action={
          viewer.can("programs:manage") ? (
            <Toolbar>
              <ChangeStatusButton inscricao={inscricao} />
              <CompletePersonButton
                pacienteId={inscricao.pacienteId}
                nome={inscricao.nome}
              />
            </Toolbar>
          ) : null
        }
      />

      <Stack>
        <Card>
          <SummaryGrid
            items={[
              { label: "Situação", value: SITUACAO_ROTULO[inscricao.situacao] },
              { label: "Inscrito em", value: toDate(inscricao.inscritoEm) },
              {
                label: "Diagnóstico em",
                value: inscricao.diagnosticoEm
                  ? toDate(inscricao.diagnosticoEm)
                  : "—",
              },
              { label: "CID", value: inscricao.cid ?? "—" },
              {
                /*
                  Nascimento vazio não é detalhe: é a pessoa caindo na linha
                  "sem data de nascimento" do relatório que vai à Promotoria.
                  A tela diz onde se conserta em vez de mostrar um travessão.
                */
                label: "Nascimento",
                value: inscricao.dataNascimento ? (
                  toDate(inscricao.dataNascimento)
                ) : (
                  <span style={{ color: "var(--erro)" }}>
                    sem data — completar cadastro
                  </span>
                ),
              },
              { label: "Terapias na fila", value: `${naFila.length}` },
            ]}
          />
          {inscricao.observacao ? (
            <p style={{ marginTop: "12px" }}>{inscricao.observacao}</p>
          ) : null}
        </Card>

        {/*
          A fila desta pessoa, e não a do serviço. O aviso existe porque uma
          indicação sem início não é um esquecimento do sistema: é alguém
          esperando, e o número ao lado é há quantos dias.
        */}
        {naFila.length > 0 ? (
          <Alert tone="info">
            {naFila.length === 1
              ? "Uma terapia indicada e ainda não iniciada."
              : `${naFila.length} terapias indicadas e ainda não iniciadas.`}{" "}
            A espera conta a partir da indicação e só para quando o primeiro
            atendimento for registrado.
          </Alert>
        ) : null}

        <Card
          title="Terapias"
          action={
            viewer.can("programs:manage") ? (
              <IndicateButton
                inscricaoId={inscricao.id}
                terapias={disponiveis}
              />
            ) : null
          }
          padded={false}
        >
          <Table
            columns={[
              "Terapia",
              "Indicada em",
              "Situação",
              "Combinado",
              "Sessões (90 dias)",
              "",
            ]}
            isEmpty={indicacoes.length === 0}
            emptyMessage="Nenhuma terapia indicada ainda."
          >
            {indicacoes.map((indicacao) => (
              <tr key={indicacao.id}>
                <td>{indicacao.terapiaNome}</td>
                <td>{toDate(indicacao.indicadaEm)}</td>
                <td>
                  {indicacao.encerradaEm ? (
                    <>
                      <Badge tone="neutral">encerrada</Badge>
                      <br />
                      <small style={{ color: "var(--texto_suave)" }}>
                        {toDate(indicacao.encerradaEm)}
                        {indicacao.motivoEncerramento
                          ? ` — ${indicacao.motivoEncerramento}`
                          : ""}
                      </small>
                    </>
                  ) : indicacao.iniciadaEm ? (
                    <>
                      <Badge tone="success">em atendimento</Badge>
                      <br />
                      <small style={{ color: "var(--texto_suave)" }}>
                        desde {toDate(indicacao.iniciadaEm)}
                      </small>
                    </>
                  ) : (
                    <>
                      <Badge tone="warning">na fila</Badge>
                      <br />
                      <small style={{ color: "var(--erro)" }}>
                        {diasDesde(indicacao.indicadaEm)} dias de espera
                      </small>
                    </>
                  )}
                </td>
                <td className={numericCell}>
                  {indicacao.periodicidadeSemanal
                    ? `${indicacao.periodicidadeSemanal}/semana`
                    : "—"}
                </td>
                <td className={numericCell}>
                  {indicacao.sessoesRecentes}
                  {indicacao.ultimaSessao ? (
                    <>
                      <br />
                      <small style={{ color: "var(--texto_suave)" }}>
                        última em {toDate(indicacao.ultimaSessao)}
                      </small>
                    </>
                  ) : null}
                </td>
                <td>
                  <Toolbar>
                    {!indicacao.iniciadaEm &&
                    !indicacao.encerradaEm &&
                    viewer.can("programs:manage") ? (
                      <StartTherapyButton
                        indicacaoId={indicacao.id}
                        inscricaoId={inscricao.id}
                        terapiaNome={indicacao.terapiaNome}
                      />
                    ) : null}
                    {indicacao.iniciadaEm &&
                    !indicacao.encerradaEm &&
                    viewer.can("programs:attend") ? (
                      <SessionButton
                        indicacaoId={indicacao.id}
                        inscricaoId={inscricao.id}
                        terapiaNome={indicacao.terapiaNome}
                      />
                    ) : null}
                    {!indicacao.encerradaEm && viewer.can("programs:manage") ? (
                      <EndTherapyButton
                        indicacaoId={indicacao.id}
                        inscricaoId={inscricao.id}
                        terapiaNome={indicacao.terapiaNome}
                      />
                    ) : null}
                  </Toolbar>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        {sessoes.map(({ indicacao, lista }) => (
          <Card
            key={indicacao.id}
            title={`Sessões — ${indicacao.terapiaNome}`}
            padded={false}
          >
            <Table
              columns={["Data", "Profissional", "Compareceu", "Observação"]}
              isEmpty={lista.length === 0}
              emptyMessage="Nenhuma sessão registrada desde o início."
            >
              {lista.map((sessao) => (
                <tr key={sessao.id}>
                  <td>{toDate(sessao.data)}</td>
                  <td>{sessao.profissional}</td>
                  <td>
                    {sessao.compareceu ? (
                      <Badge tone="success">sim</Badge>
                    ) : (
                      <Badge tone="warning">faltou</Badge>
                    )}
                  </td>
                  <td>{sessao.observacao ?? "—"}</td>
                </tr>
              ))}
            </Table>
          </Card>
        ))}
      </Stack>
    </>
  );
}
