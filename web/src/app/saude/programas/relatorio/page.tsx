import { getProgramReport, listPrograms } from "@/features/programs/queries";
import { ReportView } from "@/features/programs/components/ReportView";
import { SaveCutButton } from "@/features/programs/components/SaveCutButton";
import { requirePermission } from "@/shared/auth/guards";
import { FilterBar, FilterField } from "@/shared/ui/FilterBar";
import { toDate } from "@/shared/ui/labels";
import { Alert, Card, PageHeader, Stack } from "@/shared/ui/layout";

type PageProps = {
  searchParams: Promise<{ programa?: string; desde?: string; ate?: string }>;
};

const soData = /^\d{4}-\d{2}-\d{2}$/;

const diaDeHoje = () => new Date().toISOString().slice(0, 10);

const noventaDiasAtras = () => {
  const data = new Date();
  data.setDate(data.getDate() - 90);
  return data.toISOString().slice(0, 10);
};

/**
 * O relatório que responde a uma requisição do Ministério Público.
 *
 * A janela vem de quem pergunta, e não do sistema: "nos últimos 90 dias" numa
 * requisição, "no exercício de 2026" na seguinte. Os 90 dias são a sugestão da
 * tela, não uma regra.
 *
 * A tela não grava nada. O recorte — e com ele o documento — nasce só quando
 * alguém aperta o botão, porque salvar a cada consulta encheria o banco de
 * perguntas que ninguém respondeu.
 */
export default async function RelatorioPage({ searchParams }: PageProps) {
  const viewer = await requirePermission("programs:read", "SAUDE");
  const { programa, desde, ate } = await searchParams;

  const programas = await listPrograms().catch(() => []);
  const escolhido = programas.find((item) => item.id === programa) ?? programas[0];

  const inicio = desde && soData.test(desde) ? desde : noventaDiasAtras();
  const fim = ate && soData.test(ate) ? ate : diaDeHoje();
  const invertido = inicio > fim;

  const relatorio = escolhido && !invertido
    ? await getProgramReport(escolhido.id, inicio, fim).catch(() => null)
    : null;

  return (
    <>
      <PageHeader
        title="Relatório do programa"
        subtitle={escolhido ? `${escolhido.nome} — ${toDate(inicio)} a ${toDate(fim)}` : undefined}
        action={
          relatorio && viewer.can("documents:issue")
            ? <SaveCutButton programaId={relatorio.programa.id} desde={inicio} ate={fim} />
            : null
        }
      />

      <Stack>
        {programas.length === 0 ? (
          <Alert tone="error">
            Nenhum programa cadastrado ainda. Quem cadastra é quem administra o
            módulo, em Cadastros → Programas de cuidado.
          </Alert>
        ) : null}

        <FilterBar ativo base="/saude/programas/relatorio" acao="Apurar">
          <FilterField label="Programa" htmlFor="programa" largo>
            <select id="programa" name="programa" defaultValue={escolhido?.id ?? ""}>
              {programas.map((item) => (
                <option key={item.id} value={item.id}>{item.nome}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="De" htmlFor="desde">
            <input id="desde" name="desde" type="date" defaultValue={inicio} />
          </FilterField>
          <FilterField label="Até" htmlFor="ate">
            <input id="ate" name="ate" type="date" defaultValue={fim} />
          </FilterField>
        </FilterBar>

        {invertido ? (
          <Alert tone="error">
            O início do período não pode ser posterior ao fim — do jeito que está,
            o relatório viria vazio e pareceria que ninguém foi atendido.
          </Alert>
        ) : null}

        {/*
          O aviso é o mesmo do relatório de contratações, e pela mesma razão: os
          números mudam todo dia, e o papel precisa continuar dizendo daqui a um
          ano o que se via hoje.
        */}
        <Alert tone="info">
          Os números abaixo são apurados agora. Ao gerar o documento, eles ficam
          presos ao corpo da peça — que é o que a resposta a uma requisição
          precisa: um papel que continue dizendo, daqui a um ano, o que se via
          hoje.
        </Alert>

        {relatorio ? (
          <ReportView relatorio={relatorio} />
        ) : !invertido && escolhido ? (
          <Card>
            <p>Não foi possível apurar o relatório deste período.</p>
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
