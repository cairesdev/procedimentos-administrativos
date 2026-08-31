import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Nenhuma leitura do almoxarifado sai sem a trava por escola.
 *
 * A trava nasceu de um vazamento: ela existia só na escrita, e toda listagem
 * passava com `stock:read` puro — a escola 1 via os pedidos da escola 2. O
 * perigo agora é o inverso e é silencioso: uma consulta nova, escrita daqui a
 * seis meses, que esqueça a cláusula e volte a mostrar tudo. O compilador não
 * pega isso, porque o parâmetro chega ao método e some antes do SQL.
 *
 * Este teste lê o SQL e cobra a cláusula em cada consulta que enxerga escola.
 */

const raiz = path.join(__dirname, "..", "..", "src", "infrastructure", "db");
const ler = (arquivo: string) => readFileSync(path.join(raiz, arquivo), "utf8");

/** Consultas que expõem dado de escola, e o que cada uma precisa filtrar. */
const EXIGEM_ALCANCE: { arquivo: string; consulta: string; coluna: string }[] = [
  { arquivo: "PostgresAlmoxarifadoRepository.ts", consulta: "listarLocais", coluna: "l.id" },
  { arquivo: "PostgresAlmoxarifadoRepository.ts", consulta: "buscarLocal", coluna: "l.id" },
  {
    arquivo: "PostgresAlmoxarifadoRepository.ts",
    consulta: "estoqueDoLocal", coluna: "el.local_id",
  },
  {
    arquivo: "PostgresAlmoxarifadoRepository.ts",
    consulta: "listarSolicitacoes", coluna: "s.local_solicitante_id",
  },
  {
    arquivo: "PostgresAlmoxarifadoRepository.ts",
    consulta: "buscarSolicitacao", coluna: "s.local_solicitante_id",
  },
  { arquivo: "PostgresAlmoxarifadoRepository.ts", consulta: "listarConsumo", coluna: "c.local_id" },
  {
    arquivo: "PostgresAlmoxarifadoRepository.ts",
    consulta: "listarDevolucoes", coluna: "d.local_id",
  },
  { arquivo: "PostgresAlmoxarifadoRepository.ts", consulta: "listarAjustes", coluna: "el.local_id" },
  { arquivo: "PostgresQualidadeRepository.ts", consulta: "listar", coluna: "el.local_id" },
  {
    arquivo: "PostgresRelatorioConsumoRepository.ts",
    consulta: "listar", coluna: "r.almoxarifado_id",
  },
  {
    arquivo: "PostgresRelatorioConsumoRepository.ts",
    consulta: "buscar", coluna: "r.almoxarifado_id",
  },
];

/** Recorta uma consulta do objeto `SQL`, do nome até a crase de fechamento. */
const consulta = (fonte: string, nome: string): string => {
  const inicio = fonte.indexOf(`  ${nome}: \``);
  assert.notEqual(inicio, -1, `consulta ${nome} não encontrada`);
  const corpo = fonte.slice(inicio + nome.length + 5);
  return corpo.slice(0, corpo.indexOf("`,"));
};

describe("toda leitura de escola passa pela trava", () => {
  for (const { arquivo, consulta: nome, coluna } of EXIGEM_ALCANCE) {
    it(`${arquivo.replace("Postgres", "").replace("Repository.ts", "")}.${nome}`, () => {
      const sql = consulta(ler(arquivo), nome);

      // A forma é sempre a mesma: `$n::uuid[] IS NULL` (sem trava) ou o id
      // dentro do array. Escrever de outro jeito passaria despercebido aqui,
      // e é por isso que a forma é parte do contrato.
      const semTrava = /\$\d+::uuid\[\] IS NULL/.test(sql);
      const filtra = new RegExp(
        `${coluna.replace(".", "\\.")} = ANY\\(\\$\\d+\\)`,
      ).test(sql);

      assert.ok(semTrava, `${nome} não aceita alcance nulo — o administrador ficaria sem nada`);
      assert.ok(filtra, `${nome} não filtra por ${coluna}: a escola vizinha aparece`);
    });
  }

  it("a lista de consultas cobre o que existe", () => {
    /**
     * Sem esta guarda, apagar uma linha de `EXIGEM_ALCANCE` calaria o teste
     * dela — e o jeito mais fácil de fazer um teste de acesso passar é
     * remover o caso que ele testava.
     */
    assert.ok(EXIGEM_ALCANCE.length >= 11, `só ${EXIGEM_ALCANCE.length} consultas na lista`);
  });
});
