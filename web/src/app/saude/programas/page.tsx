import Link from "next/link";
import { listEnrolled, listPrograms } from "@/features/programs/queries";
import { EnrollButton } from "@/features/programs/components/EnrollmentActions";
import { SITUACAO_ROTULO, type Situation } from "@/features/programs/types";
import { requirePermission } from "@/shared/auth/guards";
import { Pagination } from "@/shared/ui/Pagination";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { toDate } from "@/shared/ui/labels";
import {
  Alert, Badge, Card, EmptyState, PageHeader, Stack, Table, Toolbar, numericCell,
} from "@/shared/ui/layout";

type PageProps = {
  searchParams: Promise<{
    pagina?: string; programa?: string; situacao?: string; termo?: string;
  }>;
};

const tomDaSituacao = (situacao: Situation) => {
  if (situacao === "DIAGNOSTICADO") return "success" as const;
  if (situacao === "EM_INVESTIGACAO") return "warning" as const;
  return "neutral" as const;
};

/**
 * Quem está no programa — com diagnóstico ou ainda em investigação.
 *
 * As duas situações aparecem juntas e contadas separado. Era possível listar
 * só quem tem laudo, e o número ficaria menor e mais bonito: quem está em
 * investigação também ocupa fila, também é atendido, e some do relatório se a
 * lista o esconder.
 */
export default async function InscritosPage({ searchParams }: PageProps) {
  const viewer = await requirePermission("programs:read", "SAUDE");
  const { pagina, programa, situacao, termo } = await searchParams;

  const [programas, inscritos] = await Promise.all([
    listPrograms().catch(() => []),
    listEnrolled({ pagina, programa, situacao, termo }),
  ]);

  const semPrograma = programas.length === 0;

  return (
    <>
      <PageHeader
        title="Inscritos"
        subtitle="Programas de cuidado continuado — quem está sendo acompanhado"
        action={
          viewer.can("programs:manage") && !semPrograma
            ? <EnrollButton programas={programas.filter((item) => item.ativo)} />
            : null
        }
      />

      <Stack>
        {semPrograma ? (
          <Alert tone="error">
            Nenhum programa cadastrado ainda. Sem ele não há onde inscrever
            ninguém. Quem cadastra é quem administra o módulo, em
            Cadastros → Programas de cuidado.
          </Alert>
        ) : null}

        <FilterBar
          ativo={Boolean(termo || programa || situacao)}
          base="/saude/programas"
        >
          <FilterField label="Buscar" htmlFor="termo" largo>
            <input
              id="termo"
              name="termo"
              defaultValue={termo}
              placeholder="Nome ou prontuário"
            />
          </FilterField>
          <FilterField label="Programa" htmlFor="programa">
            <select id="programa" name="programa" defaultValue={programa ?? ""}>
              <option value="">Todos</option>
              {programas.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Situação" htmlFor="situacao">
            <select id="situacao" name="situacao" defaultValue={situacao ?? ""}>
              <option value="">Todas</option>
              {Object.entries(SITUACAO_ROTULO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </FilterField>
        </FilterBar>

        <Card padded={false}>
          <Table
            columns={["Pessoa", "Situação", "Inscrito em", "Terapias", "Em atendimento", ""]}
            isEmpty={inscritos.itens.length === 0}
            emptyMessage="Ninguém inscrito com esse filtro."
            empty={
              <EmptyState
                titulo="Ninguém inscrito ainda"
                descricao={
                  "Aqui ficam as pessoas acompanhadas pelos programas de cuidado "
                  + "continuado: quem tem diagnóstico, quem ainda está em "
                  + "investigação, quais terapias foram indicadas e quantas já "
                  + "começaram. É desta lista que sai a resposta a requisições."
                }
              />
            }
          >
            {inscritos.itens.map((inscrito) => (
              <tr key={inscrito.id}>
                <td>
                  {inscrito.nome}
                  <br />
                  <small style={{ color: "var(--texto_suave)" }}>
                    prontuário {inscrito.prontuario}
                    {inscrito.dataNascimento
                      ? ` · nasc. ${toDate(inscrito.dataNascimento)}`
                      : ""}
                  </small>
                </td>
                <td>
                  <Badge tone={tomDaSituacao(inscrito.situacao)}>
                    {SITUACAO_ROTULO[inscrito.situacao]}
                  </Badge>
                  {inscrito.cid ? (
                    <>
                      <br />
                      <small style={{ color: "var(--texto_suave)" }}>{inscrito.cid}</small>
                    </>
                  ) : null}
                </td>
                <td>{toDate(inscrito.inscritoEm)}</td>
                <td className={numericCell}>{inscrito.terapiasIndicadas}</td>
                <td className={numericCell}>
                  {/*
                    Indicadas e iniciadas lado a lado: a diferença entre as duas
                    colunas é a fila desta pessoa, e é a pergunta do ofício.
                  */}
                  {inscrito.terapiasIniciadas}
                  {inscrito.terapiasIndicadas > inscrito.terapiasIniciadas ? (
                    <>
                      {" "}
                      <Badge tone="warning">
                        {inscrito.terapiasIndicadas - inscrito.terapiasIniciadas} na fila
                      </Badge>
                    </>
                  ) : null}
                </td>
                <td>
                  <Toolbar>
                    <Link href={`/saude/programas/inscritos/${inscrito.id}`}>Abrir</Link>
                  </Toolbar>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Pagination info={inscritos} base="/saude/programas" />
      </Stack>
    </>
  );
}
