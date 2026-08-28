import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * O contrato entre a API do almoxarifado e as telas.
 *
 * Vive aqui, e não no web, porque a API é a autoridade: quando uma rota muda de
 * nome, é este teste que acusa o `endpoints.ts` desatualizado — e não o usuário
 * diante de um 404.
 */

const raizApi = path.join(__dirname, "..", "..");
const raizWeb = path.join(raizApi, "..", "web", "src");

const ler = (...partes: string[]) => readFileSync(path.join(...partes), "utf8");

describe("rotas do almoxarifado", () => {
  const rotas = ler(raizApi, "src", "interface", "http", "routes", "almoxarifado.ts");
  const endpoints = ler(raizWeb, "shared", "api", "endpoints.ts");

  /** Caminhos que o router declara, já com o prefixo do `app.ts`. */
  const declaradas = [...rotas.matchAll(
    /almoxarifadoRouter\.(get|post|put|delete)\(\s*"([^"]+)"/g,
  )].map((achado) => ({
    metodo: achado[1]!.toUpperCase(),
    caminho: `/almoxarifado${achado[2] === "/" ? "" : achado[2]}`,
  }));

  it("o router declara o ciclo inteiro", () => {
    const caminhos = new Set(declaradas.map((rota) => rota.caminho));
    for (const esperado of [
      "/almoxarifado/almoxarifados",
      "/almoxarifado/tipos",
      "/almoxarifado/produtos",
      "/almoxarifado/configuracao",
      "/almoxarifado/locais",
      "/almoxarifado/remessas",
      "/almoxarifado/solicitacoes",
      "/almoxarifado/solicitacoes/:id/enviar",
      "/almoxarifado/solicitacoes/:id/liberar",
      "/almoxarifado/solicitacoes/:id/receber",
    ]) {
      assert.ok(caminhos.has(esperado), `falta a rota ${esperado}`);
    }
  });

  it("todo endpoint do web existe na API", () => {
    // Sem isto, renomear uma rota da API só aparece como 404 na tela.
    const bloco = /\/\/ Almoxarifado([\s\S]*?)vehicles:/.exec(endpoints)![1]!;

    // Nem toda interpolação do web é um `:param` do Express: em
    // `${id}/${acao}` o segundo pedaço é o NOME da ação — "enviar", "liberar".
    // Por isso a interpolação vira coringa de um segmento, e não `:id` fixo.
    const literais = [...bloco.matchAll(/`([^`]*\$\{[^`]*)`|"(\/almoxarifado[^"]*)"/g)]
      .map((achado) => achado[1] ?? achado[2] ?? "");

    const casa = (doWeb: string, daApi: string): boolean => {
      const expressao = doWeb
        .split("/")
        .map((parte) =>
          parte.includes("${")
            ? "[^/]+"
            : parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("/");
      // O lado da API também tem `:param`, que casa qualquer segmento.
      const alvo = daApi.replace(/:[^/]+/g, "PARAMETRO");
      return new RegExp(`^${expressao.replaceAll("[^/]+", "[^/]+")}$`)
        .test(alvo.replaceAll("PARAMETRO", "x"));
    };

    for (const doWeb of literais) {
      assert.ok(
        declaradas.some((rota) => casa(doWeb, rota.caminho)),
        `o web chama ${doWeb}, que a API não declara`,
      );
    }
  });

  /**
   * O que está declarado entre o caminho da rota e o início do handler — é
   * onde os middlewares moram.
   *
   * Precisa varrer várias linhas: rota com middleware costuma ser quebrada em
   * três linhas, e olhar só o resto da primeira daria falso negativo — a
   * checagem passaria numa rota que perdeu a guarda.
   */
  const entre = (metodo: string, caminho: string): string | null => {
    const inicio = new RegExp(
      `almoxarifadoRouter\\.${metodo}\\(\\s*"${caminho.replace(/[/:]/g, "\\$&")}"\\s*,`,
    ).exec(rotas);
    if (!inicio) return null;

    const resto = rotas.slice(inicio.index + inicio[0].length);
    const handler = /async\s*\(\s*req|\(\s*req\s*,/.exec(resto);
    return resto.slice(0, handler ? handler.index : 200);
  };

  it("entrada e liberação exigem a permissão de quem administra o estoque", () => {
    // Pedir é da unidade; dar entrada e liberar é de quem responde pelo
    // estoque. Confundir os dois deixaria a escola liberando para si mesma.
    //
    // Precisa casar método E caminho: a listagem de remessas é aberta a quem
    // só lê, e conferir a primeira ocorrência do caminho pegaria o GET.
    for (const [metodo, caminho] of [
      ["post", "/remessas"],
      ["post", "/solicitacoes/:id/liberar"],
      ["post", "/solicitacoes/:id/recusar"],
      ["delete", "/lotes/:id"],
      ["post", "/transferencias"],
      ["post", "/devolucoes/:id/responder"],
    ] as const) {
      const declaracao = entre(metodo, caminho);
      assert.ok(declaracao !== null, `${metodo.toUpperCase()} ${caminho} não existe`);
      assert.match(
        declaracao!,
        /administraEstoque/,
        `${metodo.toUpperCase()} ${caminho} não exige stock:manage`,
      );
    }
  });

  it("pedir e receber NÃO exigem a permissão de almoxarife", () => {
    // O contrário também é regra: a escola precisa conseguir pedir e conferir
    // o que chegou sem ter papel de quem administra o estoque.
    for (const [metodo, caminho] of [
      ["post", "/solicitacoes"],
      ["post", "/solicitacoes/:id/receber"],
      ["post", "/consumo"],
      ["post", "/devolucoes"],
      ["post", "/ajustes"],
    ] as const) {
      const declaracao = entre(metodo, caminho);
      assert.ok(declaracao !== null, `${metodo.toUpperCase()} ${caminho} não existe`);
      assert.ok(
        !/administraEstoque/.test(declaracao!),
        `${metodo.toUpperCase()} ${caminho} exige stock:manage e travaria a unidade`,
      );
    }
  });

  it("a rota literal vem antes da paramétrica", () => {
    // `/solicitacoes` depois de `/solicitacoes/:id` seria lido como id.
    const posicao = (caminho: string) =>
      declaradas.findIndex((rota) => rota.caminho === caminho);
    assert.ok(
      posicao("/almoxarifado/solicitacoes") < posicao("/almoxarifado/solicitacoes/:id"),
      "a listagem foi registrada depois do detalhe",
    );
  });
});

describe("telas do almoxarifado", () => {
  const APP = path.join(raizWeb, "app", "almoxarifado");

  const paginas = (pasta: string): string[] =>
    readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) =>
      entrada.isDirectory()
        ? paginas(path.join(pasta, entrada.name))
        : entrada.name === "page.tsx"
          ? [path.join(pasta, entrada.name)]
          : [],
    );

  /**
   * A raiz do sistema não tem tela: só manda para a primeira que o usuário
   * pode ver. Quem guarda o módulo ali é o layout, e o próprio
   * `enterWorkspace` já filtra os destinos pela permissão de cada link.
   */
  const soRedireciona = (conteudo: string) =>
    /enterWorkspace\("almoxarifado"\)/.test(conteudo) && !/apiRequest|listar|fetch/.test(conteudo);

  it("toda página guarda módulo e permissão", () => {
    // Página sem guarda aparece para prefeitura que não contratou o módulo.
    for (const arquivo of paginas(APP)) {
      const conteudo = readFileSync(arquivo, "utf8");
      const nome = path.relative(raizWeb, arquivo);
      if (soRedireciona(conteudo)) continue;

      assert.match(conteudo, /requirePermission\(/, `${nome} sem requirePermission`);
      assert.match(conteudo, /"ALMOXARIFADO"/, `${nome} não exige o módulo`);
      assert.match(conteudo, /"stock:[a-z]+"/, `${nome} não exige permissão de estoque`);
    }
  });

  it("encontra as telas da fatia", () => {
    const encontradas = paginas(APP).length;
    assert.ok(encontradas >= 8, `só ${encontradas} páginas — faltou tela da 1ª fatia`);
  });
});
