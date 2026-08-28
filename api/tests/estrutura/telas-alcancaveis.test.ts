import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { PAPEIS } from "../../src/domain/shared/Papeis";
import { permissoesDe } from "../../src/domain/shared/Permissoes";

/**
 * Tela que abre não pode morrer no meio.
 *
 * Foi o que aconteceu quando a matriz de permissões passou a valer na API:
 * COMPRAS e CONTROLADORIA entravam em Processos — tinham `processes:read` —
 * e a página estourava com 403 em `sectors:read`, porque a fila precisa
 * escrever o nome do setor ao lado do processo. O erro não aparecia em teste
 * nenhum: o web escondia botão certo, a API guardava rota certo, e ninguém
 * conferia se as duas coisas cabiam na mesma tela.
 *
 * Este teste amarra as três pontas: a permissão que a página exige para abrir,
 * as rotas que ela chama, e a permissão que cada rota exige.
 */

const raizApi = path.join(__dirname, "..", "..");
const raizWeb = path.join(raizApi, "..", "web", "src");
const ler = (...partes: string[]) => readFileSync(path.join(...partes), "utf8");

const raizDoCaminho = (caminho: string) => `/${caminho.replace(/^\//, "").split("/")[0]}`;

/** Prefixo da API → permissão do piso daquele router. */
const permissaoPorPrefixo = (): Map<string, string> => {
  const app = ler(raizApi, "src", "interface", "http", "app.ts");
  const pisos = new Map<string, string>();

  for (const arquivo of readdirSync(path.join(raizApi, "src", "interface", "http", "routes"))) {
    const conteudo = ler(raizApi, "src", "interface", "http", "routes", arquivo);
    for (const achado of conteudo.matchAll(
      /(\w+Router)\.use\(exigirPermissao\("([^"]+)"\)\)/g,
    )) {
      pisos.set(achado[1]!, achado[2]!);
    }
  }

  const mapa = new Map<string, string>();
  for (const achado of app.matchAll(/app\.use\("([^"]+)"[^\n]*?(\w+Router)\)/g)) {
    const piso = pisos.get(achado[2]!);
    if (piso) mapa.set(achado[1]!, piso);
  }
  return mapa;
};

/** Função de query do web → prefixos da API que ela chama. */
const prefixosPorFuncao = (): Map<string, string[]> => {
  const endpoints = ler(raizWeb, "shared", "api", "endpoints.ts");
  const alvo = new Map<string, string>();
  for (const achado of endpoints.matchAll(/(\w+):\s*"(\/[^"]*)"/g)) {
    alvo.set(achado[1]!, achado[2]!);
  }
  for (const achado of endpoints.matchAll(/(\w+):\s*\([^)]*\)\s*=>\s*`(\/[^`$]*)/g)) {
    alvo.set(achado[1]!, achado[2]!);
  }

  const funcoes = new Map<string, string[]>();
  const features = path.join(raizWeb, "features");

  for (const feature of readdirSync(features)) {
    const arquivo = path.join(features, feature, "queries.ts");
    let conteudo: string;
    try {
      conteudo = readFileSync(arquivo, "utf8");
    } catch {
      continue;
    }

    // Recorta de um `export const` até o próximo: pega o corpo inteiro, e não
    // até o primeiro `;` — funções com bloco têm `;` no meio.
    const marcas = [...conteudo.matchAll(/export const (\w+)\s*=/g)];
    marcas.forEach((marca, indice) => {
      const fim = marcas[indice + 1]?.index ?? conteudo.length;
      const corpo = conteudo.slice(marca.index!, fim);

      const prefixos = new Set<string>();
      for (const literal of corpo.matchAll(/apiRequest<[^>]*>\(\s*[`"](\/[^`"$]*)/g)) {
        prefixos.add(raizDoCaminho(literal[1]!));
      }
      for (const referencia of corpo.matchAll(/endpoints\.(\w+)/g)) {
        const caminho = alvo.get(referencia[1]!);
        if (caminho) prefixos.add(raizDoCaminho(caminho));
      }
      if (prefixos.size > 0) funcoes.set(marca[1]!, [...prefixos]);
    });
  }
  return funcoes;
};

/** Páginas do app, com a permissão que exigem e as queries que importam. */
const paginas = (pasta: string, encontradas: string[] = []): string[] => {
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) paginas(caminho, encontradas);
    else if (entrada.name === "page.tsx") encontradas.push(caminho);
  }
  return encontradas;
};

describe("toda tela abre inteira para quem a alcança", () => {
  const prefixoParaPermissao = permissaoPorPrefixo();
  const funcaoParaPrefixos = prefixosPorFuncao();
  const app = path.join(raizWeb, "app");
  const todas = paginas(app);

  it("os três mapas foram construídos", () => {
    // Sem esta guarda, uma regex quebrada faria o teste passar vazio — e é
    // exatamente o teste que não pode passar sem olhar nada.
    assert.ok(prefixoParaPermissao.size >= 14, `só ${prefixoParaPermissao.size} prefixos`);
    assert.ok(funcaoParaPrefixos.size >= 50, `só ${funcaoParaPrefixos.size} queries`);
    assert.ok(todas.length >= 40, `só ${todas.length} páginas`);
    assert.equal(prefixoParaPermissao.get("/setores"), "sectors:read");
    assert.deepEqual(funcaoParaPrefixos.get("listSectors"), ["/setores"]);
  });

  for (const arquivo of todas) {
    const nome = path.relative(raizWeb, arquivo);
    const conteudo = readFileSync(arquivo, "utf8");

    // A permissão que a página exige para abrir. Sem `requirePermission` a
    // tela é pública ou usa só `getViewer` — fora do escopo deste teste.
    const exigida = /requirePermission\(\s*"([a-z]+:[a-z]+)"/.exec(conteudo)?.[1];
    if (!exigida) continue;

    // Só as funções realmente importadas de `queries`: o texto inteiro pegaria
    // nomes citados em comentário.
    const importadas = new Set<string>();
    for (const bloco of conteudo.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*queries"/g)) {
      for (const item of bloco[1]!.split(",")) {
        const limpo = item.trim().split(/\s+as\s+/)[0]!.trim();
        if (limpo) importadas.add(limpo);
      }
    }

    /**
     * Busca acessória não conta.
     *
     * A tela tem duas formas legítimas de conviver com a falta de uma
     * permissão, e o código já usa as duas: perguntar antes
     * (`viewer.can("x") ? consulta() : []`) ou tolerar a falha
     * (`consulta().catch(...)`). Nos dois casos a tela abre inteira, só que
     * com menos informação — que é o comportamento certo para o que é
     * complementar. Sem esta distinção o teste exigiria dar a permissão, e o
     * jeito mais fácil de calar um teste de acesso é abrir o acesso.
     */
    const acessoria = (funcao: string): boolean => {
      const chamada = new RegExp(`${funcao}\\([^)]*\\)[\\s\\S]{0,40}?\\.catch\\(`);
      const condicional = new RegExp(`viewer\\.can\\([^)]*\\)[\\s\\S]{0,80}?${funcao}\\(`);
      return chamada.test(conteudo) || condicional.test(conteudo);
    };

    const necessarias = new Set<string>([exigida]);
    for (const funcao of importadas) {
      if (acessoria(funcao)) continue;
      for (const prefixo of funcaoParaPrefixos.get(funcao) ?? []) {
        const permissao = prefixoParaPermissao.get(prefixo);
        if (permissao) necessarias.add(permissao);
      }
    }

    if (necessarias.size <= 1) continue;

    it(`${nome} não pede mais do que quem a abre tem`, () => {
      /**
       * Todo papel que passa no `requirePermission` da página tem de ter as
       * permissões de tudo que ela busca. Se não tiver, a tela abre e estoura
       * 403 no meio — que foi o caso de COMPRAS e CONTROLADORIA na fila.
       */
      for (const papel of PAPEIS) {
        const tem = permissoesDe(papel);
        if (!tem.has(exigida)) continue;

        const faltando = [...necessarias].filter((permissao) => !tem.has(permissao));
        assert.deepEqual(
          faltando,
          [],
          `${papel} abre ${nome} (tem ${exigida}) e leva 403 em: ${faltando.join(", ")}`,
        );
      }
    });
  }
});
