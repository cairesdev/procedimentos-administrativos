import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { parse } from "pgsql-ast-parser";

/**
 * O typecheck não olha dentro de string. Estes testes leem o SQL do próprio
 * código e conferem o que já quebrou aqui antes: `$n` fora de sincronia com os
 * parâmetros passados, e consulta paginada sem `ORDER BY` — que faz linha
 * pular entre páginas e sumir da navegação.
 */

const REPOSITORIOS = path.join(__dirname, "..", "..", "src", "infrastructure", "db");
const MIGRATIONS = path.join(__dirname, "..", "..", "db", "migrations");

/** Trechos interpolados que o parser precisa ver resolvidos. */
const COMPARTILHADOS: Record<string, string> = {
  TOTAL_DA_JANELA: 'COUNT(*) OVER() AS "_total"',
};

type Consulta = { arquivo: string; nome: string; sql: string; parametros: number };

/** Conta itens no nível de cima de um array literal do TypeScript. */
const contarItens = (corpo: string): number => {
  let profundidade = 0;
  let itens = corpo.trim() ? 1 : 0;
  for (const caractere of corpo) {
    if ("([{".includes(caractere)) profundidade += 1;
    else if (")]}".includes(caractere)) profundidade -= 1;
    else if (caractere === "," && profundidade === 0) itens += 1;
  }
  return /,\s*$/.test(corpo) ? itens - 1 : itens;
};

const consultas = (): Consulta[] => {
  const encontradas: Consulta[] = [];

  for (const arquivo of readdirSync(REPOSITORIOS).filter((nome) => nome.endsWith(".ts"))) {
    const texto = readFileSync(path.join(REPOSITORIOS, arquivo), "utf8");

    const locais: Record<string, string> = {};
    for (const achado of texto.matchAll(/^const ([A-Z_0-9]+) = `([\s\S]*?)`;$/gm)) {
      locais[achado[1]!] = achado[2]!;
    }

    const templates: Record<string, string> = {};
    for (const achado of texto.matchAll(/^\s{2}(\w+):\s*`([\s\S]*?)`,\s*$/gm)) {
      templates[achado[1]!] = achado[2]!;
    }

    for (const chamada of texto.matchAll(/\.query\(\s*SQL\.(\w+)\s*,\s*\[/g)) {
      const inicio = chamada.index! + chamada[0].length - 1;
      let nivel = 0;
      let fim = inicio;
      for (let i = inicio; i < texto.length; i += 1) {
        if (texto[i] === "[") nivel += 1;
        else if (texto[i] === "]") {
          nivel -= 1;
          if (nivel === 0) {
            fim = i;
            break;
          }
        }
      }

      const template = templates[chamada[1]!];
      if (!template) continue;

      let sql = template;
      for (let volta = 0; volta < 5 && sql.includes("${"); volta += 1) {
        for (const [chave, valor] of Object.entries({ ...locais, ...COMPARTILHADOS })) {
          sql = sql.replaceAll(`\${${chave}}`, valor);
        }
      }
      assert.ok(!sql.includes("${"), `${arquivo}: ${chamada[1]} tem interpolação não resolvida`);

      encontradas.push({
        arquivo,
        nome: chamada[1]!,
        sql: sql.replace(/^\s*--.*$/gm, ""),
        parametros: contarItens(texto.slice(inicio + 1, fim)),
      });
    }
  }
  return encontradas;
};

describe("consultas dos repositórios", () => {
  const todas = consultas();

  it("encontra as consultas para conferir", () => {
    assert.ok(todas.length > 200, `só ${todas.length} consultas — o extrator parou de achar`);
  });

  it("usa exatamente os parâmetros que a chamada passa", () => {
    for (const { arquivo, nome, sql, parametros } of todas) {
      const usados = [...sql.matchAll(/\$(\d+)/g)].map((achado) => Number(achado[1]));
      const maior = usados.length > 0 ? Math.max(...usados) : 0;

      assert.equal(maior, parametros, `${arquivo} → SQL.${nome}: usa até $${maior}`);
      for (let posicao = 1; posicao <= maior; posicao += 1) {
        assert.ok(usados.includes(posicao), `${arquivo} → SQL.${nome}: $${posicao} nunca é usado`);
      }
    }
  });

  it("toda consulta paginada tem LIMIT, OFFSET e ORDER BY", () => {
    // Sem ordenação estável, linha com a mesma data troca de página entre uma
    // requisição e outra — e some da navegação.
    for (const { arquivo, nome, sql } of todas.filter((c) => c.sql.includes('AS "_total"'))) {
      assert.match(sql, /LIMIT \$\d+ OFFSET \$\d+/, `${arquivo} → SQL.${nome}: sem LIMIT/OFFSET`);
      assert.match(sql, /ORDER BY/, `${arquivo} → SQL.${nome}: paginada sem ORDER BY`);
    }
  });

  it("tem sintaxe que o Postgres aceita", () => {
    for (const { arquivo, nome, sql } of todas) {
      assert.doesNotThrow(() => parse(sql), `${arquivo} → SQL.${nome}`);
    }
  });
});

describe("migrations", () => {
  it("todas parseiam", () => {
    const arquivos = readdirSync(MIGRATIONS).filter((nome) => nome.endsWith(".sql")).sort();
    assert.ok(arquivos.length > 0, "nenhuma migration encontrada");

    for (const arquivo of arquivos) {
      const bruto = readFileSync(path.join(MIGRATIONS, arquivo), "utf8");
      // O parser não conhece dollar-quote, que o Postgres suporta: converte
      // para literal comum só para conferir a estrutura do comando.
      const conteudo = bruto.replace(
        /\$(\w*)\$([\s\S]*?)\$\1\$/g,
        (_todo, _marca, corpo: string) => `'${corpo.replaceAll("'", "''")}'`,
      );
      assert.doesNotThrow(() => parse(conteudo), arquivo);
    }
  });

  it("são numeradas em sequência, sem buraco nem repetição", () => {
    // O runner aplica em ordem de nome; número repetido faria uma passar
    // despercebida em quem já rodou a outra.
    const numeros = readdirSync(MIGRATIONS)
      .filter((nome) => nome.endsWith(".sql"))
      .map((nome) => Number(nome.slice(0, 4)))
      .sort((a, b) => a - b);

    numeros.forEach((numero, indice) => {
      assert.equal(numero, indice + 1, `migration ${numero} fora de sequência`);
    });
  });
});
