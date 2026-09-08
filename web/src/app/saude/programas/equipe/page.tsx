import { listHealthUnits } from "@/features/health/queries";
import { listPrograms, listTeam } from "@/features/programs/queries";
import {
  AddTeamMemberButton,
  EndTeamMemberButton,
} from "@/features/programs/components/TeamActions";
import { VINCULO_ROTULO } from "@/features/programs/types";
import { requirePermission } from "@/shared/auth/guards";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { toDate } from "@/shared/ui/labels";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Stack,
  SummaryGrid,
  Table,
  Toolbar,
  numericCell,
} from "@/shared/ui/layout";

type PageProps = { searchParams: Promise<{ programa?: string }> };

/**
 * O item 3 do ofício: quem atende, quantas horas, onde e com que vínculo.
 *
 * "Exclusivamente ou parcialmente" é conta, e não um campo de sim/não: quem
 * dedica ao programa toda a carga horária que tem é exclusivo. Guardar a
 * resposta pronta faria o sistema responder à pergunta de hoje e a nenhuma
 * outra — no dia em que o contrato mudasse de 40h para 20h, o "sim" continuaria
 * lá, errado e convincente.
 */
export default async function EquipePage({ searchParams }: PageProps) {
  const viewer = await requirePermission("programs:read", "SAUDE");
  const { programa } = await searchParams;

  const programas = await listPrograms().catch(() => []);
  const escolhido =
    programas.find((item) => item.id === programa) ?? programas[0];

  const [equipe, unidades] = await Promise.all([
    escolhido ? listTeam(escolhido.id) : Promise.resolve([]),
    listHealthUnits().catch(() => []),
  ]);

  const ativos = equipe.filter((membro) => !membro.encerradoEm);
  const exclusivos = ativos.filter(
    (membro) =>
      Number(membro.horasNoPrograma) >= Number(membro.cargaHorariaSemanal),
  ).length;
  const horas = ativos.reduce(
    (soma, membro) => soma + Number(membro.horasNoPrograma),
    0,
  );

  return (
    <>
      <PageHeader
        title="Equipe"
        subtitle={
          escolhido ? escolhido.nome : "Programas de cuidado continuado"
        }
        action={
          escolhido && viewer.can("programs:manage") ? (
            <AddTeamMemberButton
              programaId={escolhido.id}
              terapias={escolhido.terapias.filter((terapia) => terapia.ativo)}
              unidades={unidades.map((unidade) => ({
                id: unidade.id,
                nome: unidade.nome,
              }))}
            />
          ) : null
        }
      />

      <Stack>
        {programas.length === 0 ? (
          <Alert tone="error">
            Nenhum programa cadastrado ainda. Quem cadastra é quem administra o
            módulo, em Cadastros → Programas de cuidado.
          </Alert>
        ) : null}

        {programas.length > 1 ? (
          <FilterBar
            ativo={Boolean(programa)}
            base="/saude/programas/equipe"
            acao="Ver equipe"
          >
            <FilterField label="Programa" htmlFor="programa" largo>
              <select
                id="programa"
                name="programa"
                defaultValue={escolhido?.id ?? ""}
              >
                {programas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </FilterField>
          </FilterBar>
        ) : null}

        {escolhido ? (
          <Card>
            <SummaryGrid
              items={[
                { label: "Profissionais", value: `${ativos.length}` },
                {
                  label: "Horas semanais no programa",
                  value: `${Math.round(horas * 10) / 10}`,
                },
                { label: "Dedicação exclusiva", value: `${exclusivos}` },
                {
                  label: "Dedicação parcial",
                  value: `${ativos.length - exclusivos}`,
                },
              ]}
            />
          </Card>
        ) : null}

        <Card padded={false}>
          <Table
            columns={[
              "Profissional",
              "Terapia",
              "Local",
              "Vínculo",
              "Carga horária",
              "No programa",
              "Dedicação",
              "",
            ]}
            isEmpty={equipe.length === 0}
            emptyMessage="Ninguém na equipe deste programa."
            empty={
              <EmptyState
                titulo="Nenhum profissional na equipe"
                descricao={
                  "É esta lista que responde à terceira pergunta de uma " +
                  "requisição: carga horária, local de atuação, vínculo " +
                  "funcional, e se a pessoa atua exclusiva ou parcialmente no " +
                  "programa."
                }
              />
            }
          >
            {equipe.map((membro) => {
              const exclusivo =
                Number(membro.horasNoPrograma) >=
                Number(membro.cargaHorariaSemanal);
              return (
                <tr key={membro.id}>
                  <td>
                    {membro.nome}
                    {membro.conselho ? (
                      <>
                        <br />
                        <small style={{ color: "var(--texto_suave)" }}>
                          {membro.conselho}
                        </small>
                      </>
                    ) : null}
                  </td>
                  <td>{membro.terapiaNome ?? "—"}</td>
                  <td>{membro.unidadeSaudeNome ?? membro.localNome ?? "—"}</td>
                  <td>
                    {VINCULO_ROTULO[membro.tipoVinculo] ?? membro.tipoVinculo}
                  </td>
                  <td className={numericCell}>{membro.cargaHorariaSemanal}h</td>
                  <td className={numericCell}>{membro.horasNoPrograma}h</td>
                  <td>
                    {membro.encerradoEm ? (
                      <>
                        <Badge tone="neutral">encerrado</Badge>
                        <br />
                        <small style={{ color: "var(--texto_suave)" }}>
                          {toDate(membro.encerradoEm)}
                        </small>
                      </>
                    ) : exclusivo ? (
                      <Badge tone="success">exclusiva</Badge>
                    ) : (
                      <Badge tone="accent">parcial</Badge>
                    )}
                  </td>
                  <td>
                    <Toolbar>
                      {!membro.encerradoEm && viewer.can("programs:manage") ? (
                        <EndTeamMemberButton
                          membroId={membro.id}
                          nome={membro.nome}
                        />
                      ) : null}
                    </Toolbar>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </Stack>
    </>
  );
}
