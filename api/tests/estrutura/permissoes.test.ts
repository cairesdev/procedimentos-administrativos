import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PAPEIS } from "../../src/domain/shared/Papeis";
import {
  PERMISSOES, PERMISSOES_DO_PAPEL, permissoesDe,
} from "../../src/domain/shared/Permissoes";

/**
 * O modelo de acesso, conferido de fora.
 *
 * O buraco que estes testes existem para fechar: as permissões viviam só no
 * web, para esconder botão, e a API se defendia com `exigirPapel` em 40 das
 * ~219 rotas. Nas outras, a regra real era "tem sessão e a prefeitura contratou
 * o módulo" — bastava chamar a rota direto para passar por cima da tela.
 */

const raizApi = path.join(__dirname, "..", "..");
const raizWeb = path.join(raizApi, "..", "web", "src");
const ROTAS = path.join(raizApi, "src", "interface", "http", "routes");

const ler = (...partes: string[]) => readFileSync(path.join(...partes), "utf8");

/**
 * Routers que não passam por este modelo, com o motivo.
 *
 * `admin.ts` é o painel do produto, guardado por `authenticateAdmin` — outro
 * token, outra tabela, nada a ver com papel de prefeitura. Os demais são
 * públicos por desenho: o cidadão não tem login.
 */
const FORA_DO_MODELO: Record<string, string> = {
  "admin.ts": "painel do produto, guardado por authenticateAdmin",
  "auth.ts": "login: é onde a sessão nasce",
  "conferencia.ts": "conferência pública do documento, sem login",
  "protocoloPublico.ts": "abertura de protocolo pelo cidadão, sem login",
  "fornecedores.ts": "cadastro global; guarda declarada no próprio arquivo",
};

describe("toda rota declara a permissão que exige", () => {
  const arquivos = readdirSync(ROTAS).filter((nome) => nome.endsWith(".ts"));

  it("encontra os arquivos de rota", () => {
    assert.ok(arquivos.length >= 15, `só ${arquivos.length} arquivos — a varredura falhou`);
  });

  for (const arquivo of arquivos) {
    if (arquivo in FORA_DO_MODELO) continue;

    it(`${arquivo} tem piso de permissão`, () => {
      const conteudo = ler(ROTAS, arquivo);
      // O piso vale para o router inteiro; sem ele, cada rota do arquivo teria
      // de repetir a guarda, e é assim que uma passa despercebida.
      assert.match(
        conteudo,
        /Router\.use\(exigirPermissao\(/,
        `${arquivo} não declara piso — suas rotas aceitam qualquer sessão`,
      );
    });
  }

  it("a lista de exceções não tem entrada morta", () => {
    // Exceção que sobrevive ao arquivo que a justificava vira permissão
    // esquecida — e ninguém revisita uma lista que "sempre esteve ali".
    for (const arquivo of Object.keys(FORA_DO_MODELO)) {
      assert.ok(arquivos.includes(arquivo), `${arquivo} não existe mais e segue na exceção`);
    }
  });

  it("nenhuma rota usa o exigirPapel antigo", () => {
    // Guardar por cargo obrigava cada rota a repetir a lista, e papel novo
    // exigia revisitar todas. A permissão diz o que a ação é.
    for (const arquivo of arquivos) {
      assert.ok(
        !/exigirPapel\(/.test(ler(ROTAS, arquivo)),
        `${arquivo} ainda guarda por papel`,
      );
    }
  });

  it("toda permissão citada em rota existe no catálogo", () => {
    // Erro de digitação numa guarda a torna impossível de satisfazer: a rota
    // passa a recusar todo mundo, inclusive o ADMIN.
    for (const arquivo of arquivos) {
      const citadas = [...ler(ROTAS, arquivo).matchAll(/exigirPermissao\("([^"]+)"/g)]
        .map((achado) => achado[1]!);
      for (const permissao of citadas) {
        assert.ok(
          (PERMISSOES as readonly string[]).includes(permissao),
          `${arquivo} exige "${permissao}", que não existe no catálogo`,
        );
      }
    }
  });
});

describe("matriz de papéis", () => {
  it("todo papel do cadastro tem linha na matriz", () => {
    // Papel sem linha resulta em conjunto vazio: o usuário entra e não pode
    // nada, sem mensagem que explique.
    for (const papel of PAPEIS) {
      assert.ok(PERMISSOES_DO_PAPEL[papel], `${papel} não tem permissões declaradas`);
      assert.ok(PERMISSOES_DO_PAPEL[papel]!.length > 0, `${papel} não pode fazer nada`);
    }
  });

  it("a matriz não inventa papel que o cadastro não aceita", () => {
    for (const papel of Object.keys(PERMISSOES_DO_PAPEL)) {
      assert.ok(
        (PAPEIS as readonly string[]).includes(papel),
        `${papel} está na matriz e não existe em PAPEIS`,
      );
    }
  });

  /**
   * O caso que motivou a revisão: a nutricionista enxergava a frota inteira.
   * A culpa era de um `READ_ONLY` herdado por quase todo papel, que carregava
   * frotas, licitações, contratos e processos.
   */
  it("cada papel fica dentro da própria atribuição", () => {
    const proibido: Record<string, string[]> = {
      NUTRICIONISTA: ["fleet:read", "fleet:write", "trips:create", "assets:read",
        "bids:read", "contracts:read", "processes:read", "audit:read"],
      UNIDADE: ["fleet:read", "assets:read", "bids:read", "contracts:read",
        "processes:read", "stock:manage", "units:write", "audit:read"],
      PATRIMONIO: ["fleet:read", "stock:read", "bids:read", "contracts:read", "audit:read"],
      FROTAS: ["assets:read", "stock:read", "bids:read", "contracts:read", "audit:read"],
      PROTOCOLO: ["bids:read", "contracts:read", "requests:read", "fleet:read",
        "assets:read", "stock:read", "audit:read"],
      COMPRAS: ["fleet:read", "assets:read", "stock:read", "audit:read", "users:write"],
      SERVIDOR: ["fleet:read", "assets:read", "stock:manage", "audit:read",
        "users:read", "processes:dispatch"],
      CONTROLADORIA: ["fleet:read", "stock:read", "bids:write", "contracts:write",
        "users:write"],
    };

    for (const [papel, negadas] of Object.entries(proibido)) {
      const tem = permissoesDe(papel);
      for (const permissao of negadas) {
        assert.ok(
          !tem.has(permissao),
          `${papel} alcança "${permissao}", que não é atribuição dele`,
        );
      }
    }
  });

  it("só o administrador lê a trilha de auditoria", () => {
    // É a conduta dos próprios servidores: quem é auditado não escolhe o que
    // aparece. A controladoria lê porque é a atribuição dela.
    const comAuditoria = PAPEIS.filter((papel) => permissoesDe(papel).has("audit:read"));
    assert.deepEqual([...comAuditoria].sort(), ["ADMIN", "CONTROLADORIA"]);
  });

  it("a unidade escolar faz o ciclo dela, e só ele", () => {
    const unidade = permissoesDe("UNIDADE");
    for (const precisa of ["stock:read", "stock:request", "stock:receive", "documents:issue"]) {
      assert.ok(unidade.has(precisa), `a unidade não consegue ${precisa}`);
    }
  });
});

describe("exceções por usuário", () => {
  /**
   * `usuario_permissao` existe desde a 0001 e nunca foi lida por linha nenhuma
   * de código — mais uma configuração sem efeito. Passou a valer como válvula
   * para o caso que não cabe em papel nenhum.
   */
  it("concede o que o papel não dá", () => {
    const semExcecao = permissoesDe("NUTRICIONISTA");
    assert.ok(!semExcecao.has("fleet:read"));

    const comExcecao = permissoesDe("NUTRICIONISTA", [
      { permissao: "fleet:read", concedida: true },
    ]);
    assert.ok(comExcecao.has("fleet:read"));
  });

  it("revoga o que o papel dá", () => {
    // Tirar é tão necessário quanto dar: o servidor que perdeu a atribuição
    // mas continua no cargo.
    const comum = permissoesDe("COMPRAS");
    assert.ok(comum.has("contracts:write"));

    const restrito = permissoesDe("COMPRAS", [
      { permissao: "contracts:write", concedida: false },
    ]);
    assert.ok(!restrito.has("contracts:write"));
  });

  it("ignora permissão que não existe", () => {
    // Linha velha no banco, ou digitada errada, não pode virar acesso.
    const permitidas = permissoesDe("UNIDADE", [
      { permissao: "estoque:tudo", concedida: true },
      { permissao: "fleet:admin", concedida: true },
    ]);
    assert.ok(!permitidas.has("estoque:tudo"));
    assert.ok(!permitidas.has("fleet:admin"));
  });

  it("papel desconhecido não pode nada", () => {
    assert.equal(permissoesDe("INVENTADO").size, 0);
  });
});

describe("web espelha a matriz da API", () => {
  const web = ler(raizWeb, "shared", "auth", "permissions.ts");

  it("as duas listas de permissões são a mesma", () => {
    // O web esconde botão; a API decide. Divergir faz a tela oferecer o que a
    // API recusa — ou, pior, esconder o que ela aceita.
    const noWeb = [...web.matchAll(/"([a-z]+:[a-z]+)"/g)].map((achado) => achado[1]!);
    for (const permissao of PERMISSOES) {
      assert.ok(noWeb.includes(permissao), `o web não conhece "${permissao}"`);
    }
  });

  it("os dois lados dão as mesmas permissões a cada papel", () => {
    // O `\n` no fim do bloco fica de fora do recorte, e a última entrada da
    // matriz — hoje FROTAS — não teria como casar sem o `$` alternativo.
    const bloco = /ROLE_PERMISSIONS: Record<Role, Permission\[\]> = \{([\s\S]*?)\n\};/.exec(web)![1]!;

    for (const papel of PAPEIS) {
      const linha = new RegExp(`\\b${papel}: \\[([\\s\\S]*?)\\],(\\n|$)`).exec(bloco);
      assert.ok(linha, `o web não declara o papel ${papel}`);

      const noWeb = new Set([...linha![1]!.matchAll(/"([a-z]+:[a-z]+)"/g)]
        .map((achado) => achado[1]!));
      const naApi = permissoesDe(papel);

      assert.deepEqual(
        [...noWeb].sort(),
        [...naApi].sort(),
        `${papel} tem permissões diferentes no web e na API`,
      );
    }
  });
});
