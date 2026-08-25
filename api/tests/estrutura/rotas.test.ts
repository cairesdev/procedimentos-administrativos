import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Ordem de registro no Express: rota literal tem de vir antes da paramétrica
 * que a cobre, senão `/contratos/para-solicitacao` é lido como
 * `/contratos/:id` e o `id` vira a palavra "para-solicitacao".
 *
 * Nenhum tipo pega isso — só o comportamento em produção, tarde demais.
 */

const ROTAS = path.join(__dirname, "..", "..", "src", "interface", "http", "routes");

type Rota = { metodo: string; caminho: string };

const rotasDe = (arquivo: string): Rota[] =>
  [...readFileSync(path.join(ROTAS, arquivo), "utf8")
    .matchAll(/Router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)]
    .map((achado) => ({ metodo: achado[1]!.toUpperCase(), caminho: achado[2]! }));

/**
 * O padrão da rota como o Express o compara: `:param` casa um segmento, e o
 * resto é literal. Comparar só a quantidade de segmentos daria falso positivo —
 * `/relatorios/uso` e `/viagens/:id` têm dois segmentos e nunca se cruzam.
 */
const casa = (padrao: string, caminho: string): boolean => {
  const expressao = padrao
    .split("/")
    .map((parte) => (parte.startsWith(":") ? "[^/]+" : parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${expressao}$`).test(caminho);
};

/** Caminho concreto que uma rota literal produz na URL. */
const ehLiteral = (caminho: string) => !caminho.includes(":");

describe("o detector de rota engolida", () => {
  // Um detector que nunca dispara é pior que nenhum: passa a sensação de
  // cobertura sem cobrir nada. Estes dois casos fixam os dois lados.
  it("acusa a literal coberta pela paramétrica", () => {
    assert.ok(casa("/contratos/:id", "/contratos/para-solicitacao"));
    assert.ok(casa("/:codigo", "/protocolo"));
  });

  it("não acusa rotas que nunca se cruzam", () => {
    assert.ok(!casa("/viagens/:id", "/relatorios/uso"));
    assert.ok(!casa("/modelos/:tipo", "/escopos"));
    assert.ok(!casa("/:id", "/a/b"));
  });
});

describe("ordem das rotas", () => {
  const arquivos = readdirSync(ROTAS).filter((nome) => nome.endsWith(".ts"));

  it("encontra os arquivos de rota", () => {
    assert.ok(arquivos.length > 10, `só ${arquivos.length} arquivos de rota`);
  });

  for (const arquivo of arquivos) {
    it(`${arquivo}: nenhuma literal é engolida por paramétrica`, () => {
      const registradas = rotasDe(arquivo);

      registradas.forEach(({ metodo, caminho }, posicao) => {
        if (!ehLiteral(caminho)) return;

        const anterior = registradas
          .slice(0, posicao)
          .find((outra) => outra.metodo === metodo && !ehLiteral(outra.caminho)
            && casa(outra.caminho, caminho));

        assert.ok(
          !anterior,
          `${metodo} ${caminho} está registrada depois de `
          + `${anterior?.metodo} ${anterior?.caminho}, que a engole`,
        );
      });
    });
  }
});

describe("canal público do requerente", () => {
  const publico = readFileSync(path.join(ROTAS, "protocoloPublico.ts"), "utf8");

  it("toda ação exige protocolo mais documento", () => {
    // Sem sessão, o par é a única credencial: uma ação que o dispensasse
    // deixaria qualquer um mexer em pedido alheio.
    const acoes = [...publico.matchAll(/Router\.post\(\s*"(\/pedidos\/[^"]+)"/g)]
      .map((achado) => achado[1]!);
    assert.deepEqual(
      acoes.sort(),
      ["/pedidos/anexos", "/pedidos/exigencias", "/pedidos/responder"],
    );

    for (const acao of acoes) {
      const trecho = publico.split(`"${acao}"`)[1]!.split("protocoloPublicoRouter")[0]!;
      assert.match(trecho, /credencialSchema/, `${acao} não exige a credencial`);
    }
  });

  it("a prefeitura vem no caminho e não há listagem", () => {
    // Publicar a lista de prefeituras entregaria a carteira de clientes.
    for (const achado of publico.matchAll(/Router\.(get|post)\(\s*"(\/prefeituras[^"]*)"/g)) {
      assert.match(achado[2]!, /:cnpj/, `rota pública sem prefeitura na URL: ${achado[2]}`);
    }
  });

  it("a abertura não devolve identificador interno", () => {
    // Na rua o que vale é o protocolo.
    assert.ok(!publico.includes("id: resultado.id"), "o portal devolve o id do processo");
    assert.match(publico, /protocolo: resultado\.protocolo/);
  });
});

describe("consulta pública do protocolo", () => {
  const repositorio = readFileSync(
    path.join(__dirname, "..", "..", "src", "infrastructure", "db", "PostgresProtocoloRepository.ts"),
    "utf8",
  );

  /** Só a lista de colunas do SELECT, sem os JOINs. */
  const colunasDe = (nome: string): string => {
    const sql = new RegExp(`${nome}: \`(.*?)\`,`, "s").exec(repositorio)![1]!;
    return /SELECT(.*?)\bFROM\b/s.exec(sql)![1]!;
  };

  it("o andamento não devolve o texto do despacho", () => {
    // Despacho é peça de trabalho da administração, não resposta ao cidadão.
    const colunas = colunasDe("andamento");
    assert.ok(!colunas.includes("texto"), `andamento expõe o texto: ${colunas}`);
    assert.match(repositorio, /d\.tipo = 'ENCAMINHAMENTO'/);
  });

  it("o acompanhamento não devolve id interno ao cliente", () => {
    assert.match(repositorio, /const \{ id, \.\.\.publico \}/);
  });
});
