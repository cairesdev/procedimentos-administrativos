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

    // Duas formas de nomear a consulta: propriedade do objeto `SQL` (a maioria
    // dos repositórios) e constante solta em maiúsculas (a fonte de contexto
    // dos documentos). A segunda ficou fora da conferência por um bom tempo —
    // e é onde os `$n` são numerados à mão.
    for (const chamada of texto.matchAll(
      /\.query\(\s*(?:SQL\.(\w+)|([A-Z][A-Z_0-9]*))\s*,\s*\[/g,
    )) {
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

      const nome = chamada[1] ?? chamada[2]!;
      const template = templates[nome] ?? locais[nome];
      if (!template) continue;

      let sql = template;
      for (let volta = 0; volta < 5 && sql.includes("${"); volta += 1) {
        for (const [chave, valor] of Object.entries({ ...locais, ...COMPARTILHADOS })) {
          sql = sql.replaceAll(`\${${chave}}`, valor);
        }
      }
      assert.ok(!sql.includes("${"), `${arquivo}: ${nome} tem interpolação não resolvida`);

      encontradas.push({
        arquivo,
        nome,
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

  /**
   * Construções válidas no Postgres que o `pgsql-ast-parser` não conhece.
   *
   * A lista é curta e justificada de propósito: cada entrada some da checagem
   * de sintaxe, então é aqui que um SQL quebrado se esconderia. Todas foram
   * conferidas contra um Postgres de verdade por `db/verificar-migrations.py`.
   */
  const NAO_PARSEAVEIS: Record<string, string> = {
    bloquearLotes: "FOR UPDATE OF <alias> — trava só a linha do lote",
    bloquearEstoqueLocal: "FOR UPDATE OF <alias> — trava só o lote na unidade",
    bloquearLoteDaUnidade: "FOR UPDATE OF <alias>",
    bloquearLotePorId: "FOR UPDATE OF <alias>",
    bloquearDevolucao: "FOR UPDATE OF <alias>",
    bloquearDevolucaoSimples: "FOR UPDATE OF <alias>",
  };

  it("tem sintaxe que o Postgres aceita", () => {
    for (const { arquivo, nome, sql } of todas) {
      if (nome in NAO_PARSEAVEIS) continue;
      assert.doesNotThrow(() => parse(sql), `${arquivo} → SQL.${nome}`);
    }
  });

  it("a lista de exceções do parser não tem entrada morta", () => {
    // Exceção que sobrou depois de a consulta sumir esconderia a próxima.
    for (const nome of Object.keys(NAO_PARSEAVEIS)) {
      assert.ok(
        todas.some((consulta) => consulta.nome === nome),
        `SQL.${nome} está na lista de não parseáveis mas não existe mais`,
      );
    }
  });
});

describe("isolamento por órgão na fonte de contexto", () => {
  /**
   * O documento é emitido a partir de um id que vem da URL. Consulta que não
   * amarra o registro ao órgão da sessão deixa uma prefeitura imprimir termo
   * sobre o patrimônio de outra — basta conhecer o id.
   *
   * `transferencia_bem`, `baixa_bem`, `inventario` e `manutencao` não têm
   * `orgao_id` próprio: chegam ao órgão por join no bem, no local ou no
   * veículo. O que este teste garante é que chegam de algum jeito.
   */
  const FILHAS: Record<string, string> = {
    // Aqui o id do parâmetro é o próprio órgão: não há o que amarrar.
    ORGAO: "o registro buscado é o órgão da sessão",
    PARECER: "despacho do processo já conferido",
    ITENS_DO_PROCESSO: "itens do processo já conferido",
    ITENS_DA_SOLICITACAO: "itens da solicitação já conferida",
    BENS_CONFERIDOS: "linhas do inventário já conferido",
    ABASTECIMENTOS: "abastecimentos da viagem já conferida",
    ITENS_DO_PEDIDO: "itens do pedido de material já conferido",
    LOTES_DO_PEDIDO: "lotes entregues no pedido já conferido",
    LOTES_DA_ENTRADA: "lotes da remessa de estoque já conferida",
    VEICULO_DA_VIAGEM: "veículo alcançado pela viagem ou manutenção já conferida",
    ITENS_DO_CHECKLIST: "itens do checklist já conferido",
  };

  const daFonte = consultas().filter((c) => c.arquivo === "PostgresFonteDeContexto.ts");

  it("encontra as consultas da fonte de contexto", () => {
    assert.ok(daFonte.length > 10, `só ${daFonte.length} consultas na fonte de contexto`);
  });

  it("toda consulta de topo amarra o registro ao órgão", () => {
    for (const { nome, sql } of daFonte) {
      if (nome in FILHAS) continue;
      assert.match(
        sql,
        /\borgao_id = \$1\b/,
        `${nome} não filtra por órgão — id de outra prefeitura passaria`,
      );
    }
  });

  it("consulta filha declara de quem herda a conferência", () => {
    // Sem esta lista, bastaria alguém acrescentar uma consulta sem órgão para
    // o teste acima ficar mudo. Estar aqui é uma decisão registrada.
    for (const nome of Object.keys(FILHAS)) {
      assert.ok(
        daFonte.some((consulta) => consulta.nome === nome),
        `${nome} está na lista de exceções mas não existe mais na fonte de contexto`,
      );
    }
  });
});

describe("migrations", () => {
  it("todas parseiam", () => {
    const arquivos = readdirSync(MIGRATIONS).filter((nome) => nome.endsWith(".sql")).sort();
    assert.ok(arquivos.length > 0, "nenhuma migration encontrada");

    for (const arquivo of arquivos) {
      const bruto = readFileSync(path.join(MIGRATIONS, arquivo), "utf8");

      /**
       * PL/pgSQL sai antes de parsear — e isso é uma perda declarada.
       *
       * O parser é de SQL, não de PL/pgSQL: `CREATE FUNCTION` e `CREATE
       * TRIGGER` fazem ele parar, e o erro cai no comando **seguinte**, o que
       * mandaria quem for depurar para o lugar errado. Deixar passar custaria
       * o teste inteiro do arquivo.
       *
       * O que se perde é conferido em outro lugar, e num lugar melhor:
       * `db/verificar-migrations.py` aplica todas as migrations num Postgres
       * de verdade, onde função e gatilho são compilados pelo próprio banco —
       * um `NEW.coluna_que_nao_existe` falha lá, e aqui não falharia nem com o
       * parser certo.
       */
      const semPlpgsql = bruto
        .replace(/CREATE (?:OR REPLACE )?FUNCTION[\s\S]*?LANGUAGE plpgsql;/gi, "")
        .replace(/CREATE TRIGGER[\s\S]*?;/gi, "");

      // O parser não conhece dollar-quote, que o Postgres suporta: converte
      // para literal comum só para conferir a estrutura do comando.
      const conteudo = semPlpgsql.replace(
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
