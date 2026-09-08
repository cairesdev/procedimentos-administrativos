import Link from "next/link";
import { listVisits, listHealthUnits } from "@/features/health/queries";
import { OpenVisitButton } from "@/features/health/components/VisitActions";
import { requirePermission } from "@/shared/auth/guards";
import { Pagination } from "@/shared/ui/Pagination";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { toDateTime } from "@/shared/ui/labels";
import {
  Alert, Badge, Card, EmptyState, PageHeader, Stack, Table, Toolbar,
} from "@/shared/ui/layout";

type PageProps = {
  searchParams: Promise<{
    pagina?: string; termo?: string; status?: string; unidade?: string; completo?: string;
  }>;
};

/**
 * O quadro do plantão: quem está aqui e o que já foi feito.
 *
 * A ordem não é a de chegada pura — prioridade em cima, depois o mais antigo.
 * No pronto atendimento quem chegou antes espera menos, e quem foi marcado
 * como prioridade na triagem não espera.
 *
 * A lista mostra doze meses por padrão. Não é expurgo: nada foi apagado, e o
 * "ver histórico completo" alcança os vinte anos de guarda. O corte existe
 * porque a série de trabalho poluída era o problema que motivou o módulo.
 */
export default async function SaudePage({ searchParams }: PageProps) {
  const viewer = await requirePermission("health:read", "SAUDE");
  const { pagina, termo, status, unidade, completo } = await searchParams;

  const [visitas, unidades] = await Promise.all([
    listVisits({ pagina, termo, status, unidade, completo: completo === "true" }),
    listHealthUnits(),
  ]);

  const semUnidade = unidades.length === 0;

  return (
    <>
      <PageHeader
        title="Atendimentos"
        subtitle="A ficha do pronto atendimento — da chegada à saída"
        action={
          viewer.can("health:admit") && !semUnidade
            ? <OpenVisitButton unidades={unidades.filter((u) => u.ativo)} />
            : null
        }
      />

      <Stack>
        {/*
          Sem unidade cadastrada não há onde abrir ficha. O aviso diz quem
          resolve, porque quem esbarra nele é a recepção e a saída está noutra
          tela, com outra permissão.
        */}
        {semUnidade ? (
          <Alert tone="error">
            Nenhuma unidade de saúde cadastrada ainda. Sem ela não há onde abrir
            atendimento. Quem cadastra é o administrador da prefeitura, em
            Administração → Unidades de saúde.
          </Alert>
        ) : null}

        <FilterBar ativo={Boolean(termo || status || unidade || completo)} base="/saude">
          <FilterField label="Buscar" htmlFor="termo" largo>
            <input
              id="termo"
              name="termo"
              defaultValue={termo}
              placeholder="Número, nome do paciente ou prontuário"
            />
          </FilterField>
          <FilterField label="Situação" htmlFor="status">
            <select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">Todas</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="ENCERRADO">Encerrados</option>
            </select>
          </FilterField>
          <FilterField label="Unidade" htmlFor="unidade">
            <select id="unidade" name="unidade" defaultValue={unidade ?? ""}>
              <option value="">Todas</option>
              {unidades.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Período" htmlFor="completo">
            <select id="completo" name="completo" defaultValue={completo ?? ""}>
              <option value="">Últimos 12 meses</option>
              <option value="true">Tudo (histórico completo)</option>
            </select>
          </FilterField>
        </FilterBar>

        <Card padded={false}>
          <Table
            columns={["Aberto em", "Nº", "Paciente", "Unidade", "Andamento", ""]}
            isEmpty={visitas.itens.length === 0}
            emptyMessage="Nenhum atendimento."
            empty={
              <EmptyState
                titulo="Nenhum atendimento neste período"
                descricao={
                  "Aqui aparece cada ficha aberta no pronto atendimento: quem "
                  + "chegou, se já passou pela triagem, se o médico já avaliou e "
                  + "como o paciente saiu. A lista mostra os últimos doze meses; "
                  + "o histórico completo continua guardado."
                }
              />
            }
          >
            {visitas.itens.map((visita) => (
              <tr key={visita.id}>
                <td>{toDateTime(visita.abertoEm)}</td>
                <td>{visita.numero}</td>
                <td>
                  {visita.pacienteNome ?? (
                    <em style={{ color: "var(--erro)" }}>não identificado</em>
                  )}
                  {visita.prontuario ? (
                    <>
                      <br />
                      <small style={{ color: "var(--texto_suave)" }}>
                        prontuário {visita.prontuario}
                      </small>
                    </>
                  ) : null}
                </td>
                <td>{visita.unidadeSaudeNome}</td>
                <td>
                  {/*
                    Três marcas em vez de um status só: no pronto atendimento a
                    pergunta não é "em que estado está a ficha", é "esta pessoa
                    já foi triada? o médico já viu?".
                  */}
                  {visita.prioridade ? <Badge tone="warning">prioridade</Badge> : null}{" "}
                  {visita.temTriagem ? <Badge tone="success">triado</Badge> : null}{" "}
                  {visita.temAvaliacao ? <Badge tone="success">avaliado</Badge> : null}{" "}
                  {visita.desfechoTipo
                    ? <Badge tone="accent">{visita.desfechoTipo.toLowerCase()}</Badge>
                    : null}
                </td>
                <td>
                  <Toolbar>
                    <Link href={`/saude/atendimentos/${visita.id}`}>Abrir ficha</Link>
                  </Toolbar>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Pagination info={visitas} base="/saude" />
      </Stack>
    </>
  );
}
