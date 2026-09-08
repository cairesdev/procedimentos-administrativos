import Link from "next/link";
import { listHealthUnits, listVisits } from "@/features/health/queries";
import { listEnrolled, listPrograms } from "@/features/programs/queries";
import { getViewer } from "@/shared/auth/guards";
import { hasModule } from "@/shared/auth/permissions";
import { redirect } from "next/navigation";
import { Alert, Card, Columns, PageHeader, Stack, SummaryGrid } from "@/shared/ui/layout";

/**
 * A porta do sistema de saúde — e o mapa dos dois serviços que moram nele.
 *
 * Antes daqui, quem entrava caía direto na lista de atendimentos: cinco telas
 * numa fileira só, metade delas invisível para o seu perfil, e nenhuma pista de
 * por onde começar. Pronto atendimento e cuidado continuado são **rotinas de
 * pessoas diferentes** — a recepção do hospital nunca abre a fila de terapias,
 * e a coordenação do programa nunca abre uma ficha. O menu já separava; faltava
 * a tela que explica a separação e diz o que está esperando hoje.
 *
 * Cada bloco só aparece para quem alcança o serviço, e cada número é um link
 * para o lugar onde ele é resolvido. Consulta que falha vira bloco sem número,
 * nunca tela quebrada: quem chegou aqui procurando o caminho não pode encontrar
 * um erro.
 */
export default async function SaudePage() {
  const viewer = await getViewer();
  if (!hasModule(viewer.modules, "SAUDE")) redirect("/modulo-indisponivel");

  const noPlantao = viewer.can("health:read");
  const noPrograma = viewer.can("programs:read");
  if (!noPlantao && !noPrograma) redirect("/");

  const [emAndamento, unidades, inscritos, programas] = await Promise.all([
    noPlantao
      ? listVisits({ status: "EM_ANDAMENTO" }).catch(() => null)
      : Promise.resolve(null),
    noPlantao || viewer.can("health:manage")
      ? listHealthUnits().catch(() => [])
      : Promise.resolve([]),
    noPrograma ? listEnrolled({}).catch(() => null) : Promise.resolve(null),
    noPrograma ? listPrograms().catch(() => []) : Promise.resolve([]),
  ]);

  /**
   * Quantas pessoas esperam alguma terapia.
   *
   * A conta é por pessoa nesta tela, e por terapia no relatório — e as duas
   * estão certas. Aqui a pergunta é "quantas famílias estão esperando"; no
   * ofício é "qual a fila de cada terapia", que é o que a Promotoria pediu.
   */
  const naFila = (inscritos?.itens ?? []).filter(
    (pessoa) => pessoa.terapiasIndicadas > pessoa.terapiasIniciadas,
  ).length;

  const semUnidade = noPlantao && unidades.length === 0;
  const semPrograma = noPrograma && programas.length === 0;

  return (
    <>
      <PageHeader
        title="Saúde"
        subtitle="Dois serviços no mesmo sistema: o pronto atendimento e o cuidado continuado"
      />

      <Stack>
        {/*
          Os dois avisos de cadastro faltando vêm primeiro porque **travam o
          serviço inteiro**: sem unidade não há onde abrir ficha, sem programa
          não há onde inscrever ninguém. Quem os resolve é quem administra o
          módulo, e o caminho está dito na frase.
        */}
        {semUnidade ? (
          <Alert tone="error">
            Nenhuma unidade de saúde cadastrada — sem ela não há onde abrir
            atendimento.{" "}
            {viewer.can("health:manage")
              ? <Link href="/saude/cadastros/unidades">Cadastrar a primeira</Link>
              : "Quem cadastra é quem administra o módulo, em Cadastros → Unidades de saúde."}
          </Alert>
        ) : null}

        {semPrograma ? (
          <Alert tone="error">
            Nenhum programa de cuidado cadastrado — sem ele não há onde
            inscrever ninguém.{" "}
            {viewer.can("programs:setup")
              ? <Link href="/saude/cadastros/programas">Criar o primeiro</Link>
              : "Quem cadastra é quem administra o módulo, em Cadastros → Programas de cuidado."}
          </Alert>
        ) : null}

        <Columns>
          {noPlantao ? (
            <Card title="Pronto atendimento">
              <p style={{ marginTop: 0, color: "var(--texto_suave)" }}>
                A ficha do hospital, da chegada à saída: recepção, triagem,
                avaliação médica, medicação e alta.
              </p>
              <SummaryGrid
                items={[
                  {
                    label: "Em atendimento agora",
                    value: emAndamento ? `${emAndamento.total}` : "—",
                  },
                  { label: "Unidades", value: `${unidades.length}` },
                ]}
              />
              <p style={{ marginBottom: 0 }}>
                <Link href="/saude/atendimentos">Ver os atendimentos</Link>
                {" · "}
                <Link href="/saude/pacientes">Pacientes</Link>
              </p>
            </Card>
          ) : null}

          {noPrograma ? (
            <Card title="Cuidado continuado">
              <p style={{ marginTop: 0, color: "var(--texto_suave)" }}>
                Os programas de acompanhamento — TEA, saúde mental, gestante de
                risco: inscrição, fila por terapia, sessões e o relatório que
                responde a requisições.
              </p>
              <SummaryGrid
                items={[
                  {
                    label: "Pessoas acompanhadas",
                    value: inscritos ? `${inscritos.total}` : "—",
                  },
                  {
                    /*
                      A fila fica em vermelho quando existe. É o número que a
                      Promotoria pergunta, e ele cresce sozinho todo dia em que
                      ninguém registra o início da terapia.
                    */
                    label: "Esperando alguma terapia",
                    value: naFila > 0
                      ? <span style={{ color: "var(--erro)" }}>{naFila}</span>
                      : "0",
                  },
                ]}
              />
              <p style={{ marginBottom: 0 }}>
                <Link href="/saude/programas">Ver os inscritos</Link>
                {" · "}
                <Link href="/saude/programas/relatorio">Relatório</Link>
              </p>
            </Card>
          ) : null}
        </Columns>

        {viewer.can("health:manage") || viewer.can("programs:setup") ? (
          <Card title="Cadastros">
            <p style={{ marginTop: 0, color: "var(--texto_suave)" }}>
              O que o serviço precisa ter antes de funcionar. Não há pessoa
              nenhuma aqui dentro.
            </p>
            <p style={{ marginBottom: 0 }}>
              {viewer.can("health:manage") ? (
                <Link href="/saude/cadastros/unidades">Unidades de saúde</Link>
              ) : null}
              {viewer.can("health:manage") && viewer.can("programs:setup") ? " · " : null}
              {viewer.can("programs:setup") ? (
                <Link href="/saude/cadastros/programas">Programas de cuidado</Link>
              ) : null}
            </p>
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
