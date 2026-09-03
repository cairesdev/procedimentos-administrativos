import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPOSITORIO = readFileSync(
  path.join(__dirname, "..", "..", "src", "infrastructure", "db",
    "PostgresChecklistRepository.ts"),
  "utf8",
);

const PORT = readFileSync(
  path.join(__dirname, "..", "..", "src", "application", "ports", "ChecklistRepository.ts"),
  "utf8",
);

const TIPOS_WEB = readFileSync(
  path.join(__dirname, "..", "..", "..", "web", "src", "features", "checklists", "types.ts"),
  "utf8",
);

/**
 * O checklist mostra o registro pelo número, e não pelo uuid.
 *
 * `alvo_tipo` + `alvo_id` é como a tabela guarda o vínculo, e é ilegível: a
 * listagem dizia "processo · 3f2a1b8c" e obrigava a abrir o registro para
 * saber de que processo se tratava. O número vem de um subselect por tipo.
 *
 * O teste trava as três pontas juntas — consulta, port e tipo do web —, porque
 * remover a coluna de uma delas devolve a tela ao uuid sem que nada quebre.
 */
test("as três consultas de checklist trazem o número do alvo", () => {
  for (const consulta of ["listar:", "listarDoAlvo:", "buscar:"]) {
    const inicio = REPOSITORIO.indexOf(`\n  ${consulta}`);
    assert.notEqual(inicio, -1, `consulta ${consulta} sumiu do repositório`);

    const corpo = REPOSITORIO.slice(inicio, REPOSITORIO.indexOf("`,", inicio));
    assert.ok(
      corpo.includes("COLUNAS_ALVO"),
      `${consulta} deixou de trazer o rótulo do alvo — a tela volta ao uuid`,
    );
  }
});

test("o número do alvo respeita o isolamento entre prefeituras", () => {
  const inicio = REPOSITORIO.indexOf("const ALVO_NUMERO = `");
  assert.notEqual(inicio, -1, "o fragmento do número do alvo sumiu");
  const fragmento = REPOSITORIO.slice(inicio, REPOSITORIO.indexOf("const COLUNAS_ALVO", inicio));

  /**
   * Um `alvo_id` apontando para registro de outra prefeitura não pode revelar
   * o número dela. Cada ramo repete o `orgao_id` do próprio checklist.
   *
   * Fornecedor é a exceção deliberada do projeto: cadastro global, sem coluna
   * de órgão. Daí a contagem ser por tabela e não por ramo.
   */
  for (const tabela of ["processo p", "contrato c", "licitacao l"]) {
    const alias = tabela.split(" ")[1];
    const ramos = fragmento.split(`FROM ${tabela}`).length - 1;
    const travas = fragmento.split(`${alias}.orgao_id = ck.orgao_id`).length - 1;
    assert.equal(
      ramos, travas,
      `${tabela}: ${ramos} subselect(s) e ${travas} filtro(s) de órgão`,
    );
  }
});

test("port e web declaram o número e o rótulo do alvo", () => {
  for (const campo of ["alvoNumero", "alvoRotulo"]) {
    assert.ok(PORT.includes(`${campo}: string | null;`), `${campo} fora do port`);
    assert.ok(TIPOS_WEB.includes(`${campo}: string | null;`), `${campo} fora do tipo do web`);
  }
});
