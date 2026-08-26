import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

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
    const migration = ler(raizApi, "db", "migrations", "0019_modulo_protocolo.sql");
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

describe("alcance dos papéis", () => {
  const permissoes = ler(raizWeb, "shared", "auth", "permissions.ts");
  const somenteLeitura = aspas(
    /const READ_ONLY: Permission\[\] = \[(.*?)\];/s.exec(permissoes)![1]!,
  );

  const porPapel = new Map<string, string[]>();
  for (const achado of
    (/ROLE_PERMISSIONS: Record<Role, Permission\[\]> = \{(.*?)^\};/ms.exec(permissoes)![1]!)
      .matchAll(/^ {2}(\w+): \[(.*?)\],$/gms)) {
    const lista = aspas(achado[2]!);
    porPapel.set(
      achado[1]!,
      achado[2]!.includes("...READ_ONLY") ? [...somenteLeitura, ...lista] : lista,
    );
  }

  it("o balcão só alcança o protocolo", () => {
    // Quem atende no balcão não precisa de licitação, contrato nem solicitação.
    const balcao = porPapel.get("PROTOCOLO")!;
    assert.deepEqual(
      [...balcao].sort(),
      ["documents:issue", "protocol:read", "protocol:serve"],
    );
  });

  it("a trilha de auditoria é só do administrador", () => {
    // É registro de conduta dos servidores, não relatório operacional.
    const comAuditoria = [...porPapel]
      .filter(([, lista]) => lista.includes("audit:read"))
      .map(([papel]) => papel);
    assert.deepEqual(comAuditoria, ["ADMIN"]);
  });

  it("todo papel declarado tem alguma permissão", () => {
    for (const [papel, lista] of porPapel) {
      assert.ok(lista.length > 0, `papel ${papel} não pode fazer nada`);
    }
  });
});

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
