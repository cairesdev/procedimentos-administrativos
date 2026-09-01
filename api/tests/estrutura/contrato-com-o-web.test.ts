import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ESCOPOS } from "../../src/domain/documento/Catalogo";

/**
 * A API e o web repetem algumas listas — eventos de auditoria, módulos,
 * permissões. Nada os obriga a concordar, e já não concordaram: o papel FROTAS
 * entrou no banco e no front e ficou de fora dos enums Zod da API, derrubando
 * o cadastro de usuário com "papelBase: invalid enum value".
 *
 * Estes testes leem os dois lados e falham quando divergem. Vivem aqui, e não
 * no web, porque a API é a autoridade sobre o contrato.
 */

const raizApi = path.join(__dirname, "..", "..");
const raizWeb = path.join(raizApi, "..", "web", "src");

const ler = (...partes: string[]) => readFileSync(path.join(...partes), "utf8");
const aspas = (texto: string) => [...texto.matchAll(/"([\w:]+)"/g)].map((achado) => achado[1]!);

describe("eventos de auditoria", () => {
  const api = ler(raizApi, "src", "application", "ports", "AuditoriaRepository.ts");
  const web = ler(raizWeb, "features", "audit", "types.ts");

  const naApi = new Set(
    [...api.matchAll(/^\s*\|\s*"(\w+)"/gm)].map((achado) => achado[1]!),
  );
  const noWeb = new Set(aspas(/AUDIT_EVENTS = \[(.*?)\] as const;/s.exec(web)![1]!));

  it("as duas listas têm os mesmos eventos", () => {
    assert.deepEqual(
      [...naApi].sort(),
      [...noWeb].sort(),
      "evento registrado num lado e desconhecido no outro",
    );
  });

  it("todo evento tem rótulo e grupo na tela de auditoria", () => {
    // Evento sem rótulo aparece como identificador cru para o administrador.
    const rotulos = new Set(
      [...(/EVENT_LABELS[^=]*= \{(.*?)^\};/ms.exec(web)![1]!)
        .matchAll(/^\s{2}(\w+):/gm)].map((achado) => achado[1]!),
    );
    const emGrupos = new Set(aspas(/EVENT_GROUPS[^=]*= \[(.*?)^\];/ms.exec(web)![1]!));

    assert.deepEqual([...noWeb].filter((evento) => !rotulos.has(evento)), []);
    assert.deepEqual([...noWeb].filter((evento) => !emGrupos.has(evento)), []);
  });
});

describe("módulos contratáveis", () => {
  it("banco, API, tipo do web e painel do produto concordam", () => {
    // O painel tinha lista própria e não acompanhou o CHECK do banco: nenhuma
    // prefeitura conseguia contratar o módulo novo.
    // A migration é procurada, e não nomeada: apontar para um arquivo fixo
    // fazia o teste medir um CHECK que outra migration já tinha substituído —
    // ele continuaria verde enquanto o banco recusava o módulo novo.
    const pasta = path.join(raizApi, "db", "migrations");
    //
    // `documento_modelo` tem um CHECK de módulo com a mesma cara, e casar por
    // "CHECK (modulo IN" pegava o dela — que lista os módulos com peça, e não
    // os contratáveis. O nome da tabela precisa entrar no filtro.
    const comCheck = readdirSync(pasta).sort().filter((arquivo) => {
      const conteudo = readFileSync(path.join(pasta, arquivo), "utf8");
      return /ALTER TABLE orgao_modulo[\s\S]*?CHECK \(modulo IN \(/.test(conteudo)
        || /CREATE TABLE orgao_modulo[\s\S]*?CHECK \(modulo IN \(/.test(conteudo);
    });
    const migration = readFileSync(
      path.join(pasta, comCheck[comCheck.length - 1]!), "utf8",
    );
    const noBanco = new Set(
      [...(/CHECK \(modulo IN \((.*?)\)\)/s.exec(migration)![1]!)
        .matchAll(/'(\w+)'/g)].map((achado) => achado[1]!),
    );

    const naApi = new Set(aspas(
      /const MODULOS = \[(.*?)\]/s.exec(ler(raizApi, "src", "interface", "http", "routes", "admin.ts"))![1]!,
    ));
    const noTipo = new Set(aspas(
      /export type ModuleName =(.*?);/s.exec(ler(raizWeb, "features", "auth", "types.ts"))![1]!,
    ));
    const noPainel = new Set(aspas(
      /MODULES: ModuleName\[\] = \[(.*?)\]/s.exec(ler(raizWeb, "features", "system-admin", "types.ts"))![1]!,
    ));

    const referencia = [...noBanco].sort();
    assert.deepEqual([...naApi].sort(), referencia, "API diverge do banco");
    assert.deepEqual([...noTipo].sort(), referencia, "tipo do web diverge do banco");
    assert.deepEqual([...noPainel].sort(), referencia, "painel do produto diverge do banco");
  });
});

describe("escopos de documento", () => {
  it("a lista do web tem os mesmos escopos da API", () => {
    // O web usa a lista para tipar a tela de criação de modelo. Escopo que
    // existe só num lado deixa o administrador escolher algo que a API recusa,
    // ou esconde dele uma peça que já dá para criar.
    const naApi = aspas(
      /export const ESCOPOS = \[(.*?)\] as const;/s.exec(
        ler(raizApi, "src", "domain", "documento", "Catalogo.ts"),
      )![1]!,
    );
    const noWeb = aspas(
      /export const DOCUMENT_SCOPES = \[(.*?)\] as const;/s.exec(
        ler(raizWeb, "features", "documents", "types.ts"),
      )![1]!,
    );

    assert.deepEqual([...noWeb].sort(), [...naApi].sort());
  });
});

/*
 * O alcance de cada papel mudou de casa: agora a matriz vive na API, em
 * `domain/shared/Permissoes.ts`, e quem a confere é `permissoes.test.ts` —
 * inclusive o espelho que o web mantém. Este arquivo continua responsável
 * pelas listas que os dois lados repetem por outras razões.
 */

describe("espaçamento das páginas", () => {
  /**
   * Os cards saíam encostados nas telas de detalhe — com borda e sombra,
   * parecendo um por cima do outro. A causa era o espaçamento depender de cada
   * página lembrar de embrulhar tudo num `<Stack>`; sete telas não lembravam.
   *
   * A regra passou a ser: o container da página é uma pilha. Estas checagens
   * guardam as duas metades, porque a correção vive em CSS e some numa revisão
   * distraída — e o sintoma só aparece olhando a tela.
   */
  const regra = (css: string, seletor: string): string =>
    new RegExp(`\\.${seletor}\\s*\\{([^}]*)\\}`).exec(css)![1]!;

  it("a área de conteúdo espaça os filhos sozinha", () => {
    for (const [arquivo, caminho] of [
      ["painel da prefeitura", ["shared", "workspace", "workspace.module.css"]],
      ["painel do produto", ["app", "admin", "admin.module.css"]],
    ] as const) {
      const conteudo = regra(ler(raizWeb, ...caminho), "content");
      assert.match(conteudo, /display:\s*grid/, `${arquivo}: .content não é grade`);
      assert.match(conteudo, /gap:/, `${arquivo}: .content sem gap`);
    }
  });

  it("o cabeçalho não traz margem própria", () => {
    // Margem aqui somaria ao gap da pilha e abriria um buraco de 36px entre o
    // título e o primeiro card.
    const layout = ler(raizWeb, "shared", "ui", "layout.module.css");
    assert.ok(
      !/margin-bottom/.test(regra(layout, "page_header")),
      ".page_header voltou a ter margem — vai somar com o gap da pilha",
    );
  });

  it("card e pilha não deixam conteúdo largo vazar", () => {
    // Tabela de sete colunas era pintada para fora do card, por cima da coluna
    // ao lado. Item de grade tem largura mínima de conteúdo por padrão.
    const layout = ler(raizWeb, "shared", "ui", "layout.module.css");
    assert.match(regra(layout, "card"), /overflow:\s*hidden/);
    assert.match(regra(layout, "stack"), /grid-template-columns:\s*minmax\(0/);
    assert.match(regra(layout, "table_scroll"), /overflow-x:\s*auto/);
  });
});

describe("rotas públicas do web", () => {
  const proxy = ler(raizWeb, "proxy.ts");
  const padrao = /"(\/\(\(\?!.*?\)\.\*\))"/.exec(proxy)![1]!;
  const exigeSessao = (caminho: string) => new RegExp(`^${padrao}$`).test(caminho);

  it("o cidadão entra sem login; o resto exige sessão", () => {
    for (const aberta of [
      "/login", "/conferencia", "/conferencia/ABCD-2345-6789",
      "/cidadao", "/cidadao/abrir/06125389000188",
      "/api/publico/06125389000188/pedidos", "/admin", "/admin/modelos",
    ]) {
      assert.ok(!exigeSessao(aberta), `${aberta} não deveria exigir sessão`);
    }

    for (const fechada of [
      "/", "/processos/fila", "/patrimonio/bens",
      "/protocolo", "/protocolo/atendimentos", "/protocolo/assuntos",
      "/administracao/documentos",
      // A peça emitida saiu de /processos e virou rota neutra: continua
      // exigindo sessão. Quem confere sem login usa /conferencia/{codigo}.
      "/documentos", "/documentos/9f1c",
    ]) {
      assert.ok(exigeSessao(fechada), `${fechada} deveria exigir sessão`);
    }
  });

  it("prefixo parecido não vira exceção", () => {
    // `admin` solto casava `/administracao/*`, que ficou fora da checagem de
    // sessão do proxy sem ninguém notar.
    for (const armadilha of [
      "/administracao", "/protocolos", "/cidadaos", "/logins", "/conferencias",
      "/api/publicos", "/api/proxy/auth/eu",
    ]) {
      assert.ok(exigeSessao(armadilha), `prefixo solto deixou ${armadilha} passar`);
    }
  });

  it("rota de módulo é guardada pelo módulo certo", () => {
    const mapa = /moduleRoutes: Record<string, ModuleName> = \{(.*?)\};/s.exec(proxy)![1]!;
    for (const [rota, modulo] of [
      ["/processos", "PROCESSOS"],
      ["/protocolo", "PROTOCOLO"],
      ["/patrimonio", "PATRIMONIO"],
      ["/frotas", "FROTAS"],
    ]) {
      assert.match(mapa, new RegExp(`"${rota}": "${modulo}"`), `${rota} sem guarda de módulo`);
    }
  });
});

/**
 * O hub e o menu levam à raiz de cada sistema (`/almoxarifado`, `/frotas`…).
 * O almoxarifado nasceu sem `page.tsx` na raiz e dava 404 no primeiro clique
 * do hub — nada apontava o buraco, porque cada tela interna existia.
 */
describe("raiz de cada sistema", () => {
  const modulos = ler(raizWeb, "shared", "auth", "modules.ts");
  const bases = [...modulos.matchAll(/basePath: "\/(\w+)"/g)].map((achado) => achado[1]!);

  it("encontra todos os sistemas declarados", () => {
    assert.ok(bases.length >= 6, `só ${bases.length} basePath — a regex não leu modules.ts`);
  });

  for (const base of bases) {
    it(`/${base} tem página de entrada`, () => {
      const raiz = path.join(raizWeb, "app", base, "page.tsx");
      assert.ok(existsSync(raiz), `/${base} está no menu e não tem app/${base}/page.tsx`);
    });
  }
});

/**
 * Escopo sem tela é modelo invisivel: a peca existe no banco, renderiza nos
 * testes, e nenhum servidor consegue pedi-la. Aconteceu tres vezes — ordem de
 * fornecimento, comprovante de solicitacao e as pecas de patrimonio antes da
 * 0020 —, sempre com o mesmo sintoma: "faltou a tela".
 *
 * A emissao passa por IssueDocumentPanel ou IssueDocumentButton, e cada tela
 * filtra os modelos pelo escopo. Se o literal do escopo nao aparece em nenhum
 * desses arquivos, nao ha caminho ate ele.
 */
describe("escopo de documento alcancavel pela interface", () => {
  const arquivosDeEmissao = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) return arquivosDeEmissao(caminho);
      if (!entrada.name.endsWith(".tsx") && !entrada.name.endsWith(".ts")) return [];
      const conteudo = readFileSync(caminho, "utf8");
      // Os proprios componentes de emissao nao filtram escopo: quem filtra e
      // a tela que os usa. Incluir types.ts traz PROCESS_SCOPES.
      const ehComponente = /components[\\/]IssueDocument/.test(caminho);
      const usaEmissao = /IssueDocumentPanel|IssueDocumentButton/.test(conteudo);
      const ehCatalogoDeEscopos = /features[\\/]documents[\\/]types\.ts$/.test(caminho);
      return (usaEmissao && !ehComponente) || ehCatalogoDeEscopos ? [conteudo] : [];
    });

  // Só as linhas que falam de escopo: o literal solto ("BEM" num rotulo,
  // "PROCESSO" num texto) nao prova que existe filtro.
  const linhas = arquivosDeEmissao(path.join(raizWeb))
    .flatMap((conteudo) => conteudo.split("\n"))
    .filter((linha) => /escopo|SCOPES/.test(linha))
    .join("\n");

  it("achou as telas que emitem", () => {
    assert.ok(linhas.length > 0, "nenhuma tela de emissao encontrada — a varredura falhou");
  });

  for (const escopo of ESCOPOS) {
    it(`${escopo} tem tela que o emite`, () => {
      assert.ok(
        linhas.includes(`"${escopo}"`),
        `nenhuma tela filtra modelos por "${escopo}" — o modelo existe e ninguem alcanca`,
      );
    });
  }
});

/**
 * O documento passou a nascer em rascunho. As garantias que fazem isso valer a
 * pena sao estruturais, e cada uma ja falhou em algum sistema por descuido de
 * uma linha: rascunho visivel na conferencia publica, rascunho contado como
 * documento do registro, e edicao aceita depois da emissao.
 */
describe("rascunho de documento nao vaza para fora", () => {
  const repositorio = ler(
    raizApi, "src", "infrastructure", "db", "PostgresDocumentoRepository.ts",
  );

  it("a conferencia publica so encontra peca emitida", () => {
    // O codigo existe desde o rascunho, porque o corpo o imprime. Sem este
    // filtro, quem digitasse o codigo veria um texto ainda em revisao.
    const consulta = /buscarPorCodigo: `([\s\S]*?)`/.exec(repositorio)![1]!;
    assert.match(
      consulta,
      /situacao = 'EMITIDO'/,
      "a conferencia publica mostraria rascunho",
    );
  });

  it("as listagens do registro ignoram rascunho", () => {
    for (const nome of ["listarPorReferencia", "listarEmitidos"]) {
      const consulta = new RegExp(`${nome}: \`([\\s\\S]*?)\``).exec(repositorio)![1]!;
      assert.match(consulta, /situacao = 'EMITIDO'/, `${nome} conta rascunho como documento`);
    }
  });

  it("emitir e condicional: dois cliques nao emitem duas vezes", () => {
    const consulta = /confirmarEmissao: `([\s\S]*?)`/.exec(repositorio)![1]!;
    assert.match(
      consulta,
      /situacao = 'RASCUNHO'/,
      "sem a condicao no UPDATE, a segunda chamada re-carimbaria a data",
    );
  });

  it("so rascunho e apagado; o que circulou se cancela", () => {
    const consulta = /descartarRascunho: `([\s\S]*?)`/.exec(repositorio)![1]!;
    assert.match(consulta, /situacao = 'RASCUNHO'/, "o DELETE alcancaria documento emitido");
  });

  it("o corpo editado passa pelo sanitizador do modelo", () => {
    // A pagina de conferencia e publica: HTML vindo do editor sem limpeza
    // seria XSS servido pela prefeitura.
    const casoDeUso = ler(raizApi, "src", "application", "documento", "EmitirDocumento.ts");
    const salvar = /salvarCorpo = async[\s\S]*?\n  \};/.exec(casoDeUso)![0];
    assert.match(salvar, /limparCorpo\(/, "corpo do editor gravado sem sanitizar");
  });
});
