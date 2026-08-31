import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  CATALOGO_POR_ESCOPO, ESCOPOS, MODULO_DO_ESCOPO, ehEscopo,
  type EscopoDeDocumento,
} from "../../src/domain/documento/Catalogo";
import { limparCorpo, tagsRemovidas } from "../../src/domain/documento/CorpoSeguro";
import { renderizar, validarContraCatalogo } from "../../src/domain/documento/Marcadores";

/**
 * Os modelos globais são texto dentro de uma migration: nenhum tipo os olha, e
 * um marcador errado só apareceria quando um servidor clicasse em "emitir" —
 * com o erro chegando a quem não pode corrigi-lo.
 *
 * Este teste lê a própria migration e submete cada corpo ao mesmo caminho da
 * emissão: catálogo, sanitizador e renderização com contexto completo.
 */

const MIGRATIONS = path.join(__dirname, "..", "..", "db", "migrations");

type ModeloSemeado = {
  arquivo: string;
  modulo: string;
  escopo: string;
  tipo: string;
  nome: string;
  titulo: string;
  corpo: string;
};

const ler = (arquivo: string) => readFileSync(path.join(MIGRATIONS, arquivo), "utf8");

/**
 * `escopo` só nasceu em 0016, que o atribuiu por UPDATE aos sete modelos de
 * 0015 — quem não foi citado ficou com o default 'PROCESSO'. Migration
 * posterior traz a coluna no próprio INSERT.
 */
const escopoRetroativo = (): Record<string, string> => {
  const mapa: Record<string, string> = {};
  const texto = ler("0016_modelo_escopo.sql");

  for (const achado of texto.matchAll(
    /SET escopo = '(\w+)'\s*WHERE tipo (?:IN \(([^)]*)\)|= '(\w+)')/g,
  )) {
    const tipos = achado[3]
      ? [achado[3]]
      : [...achado[2]!.matchAll(/'(\w+)'/g)].map((item) => item[1]!);
    for (const tipo of tipos) mapa[tipo] = achado[1]!;
  }
  return mapa;
};

/**
 * Cada tupla do INSERT. O número de campos entre aspas antes do corpo diz se a
 * migration já declarava o escopo: quatro (módulo, tipo, nome, título) é o
 * formato antigo; cinco traz o escopo no meio.
 */
const modelosDe = (arquivo: string, retroativo: Record<string, string>): ModeloSemeado[] => {
  const texto = ler(arquivo);
  if (!texto.includes("INSERT INTO documento_modelo")) return [];

  return [...texto.matchAll(/\(NULL,\s*((?:'[^']*',\s*)+)\$corpo\$([\s\S]*?)\$corpo\$\)/g)].map(
    (achado) => {
      const campos = [...achado[1]!.matchAll(/'([^']*)'/g)].map((campo) => campo[1]!);
      assert.ok(
        campos.length === 4 || campos.length === 5,
        `${arquivo}: tupla com ${campos.length} campos antes do corpo`,
      );

      const [modulo, ...resto] = campos;
      const [escopo, tipo, nome, titulo] = campos.length === 5
        ? resto
        : [retroativo[resto[0]!] ?? "PROCESSO", ...resto];

      return {
        arquivo,
        modulo: modulo!,
        escopo: escopo!,
        tipo: tipo!,
        nome: nome!,
        titulo: titulo!,
        corpo: achado[2]!,
      };
    },
  );
};

const semeados = (): ModeloSemeado[] => {
  const retroativo = escopoRetroativo();
  return readdirSync(MIGRATIONS)
    .filter((nome) => nome.endsWith(".sql"))
    .sort()
    .flatMap((arquivo) => modelosDe(arquivo, retroativo));
};

/**
 * Contexto com **todo** marcador do catálogo preenchido. Renderizar contra ele
 * prova que o modelo não pede nada que a fonte de contexto não entrega — a
 * emissão derruba com 422 no primeiro marcador desconhecido.
 */
const contextoCompleto = (escopo: EscopoDeDocumento) => {
  const catalogo = CATALOGO_POR_ESCOPO[escopo];
  const contexto: Record<string, unknown> = {};

  for (const caminho of catalogo.valores) {
    const partes = caminho.split(".");
    let atual = contexto;
    for (const parte of partes.slice(0, -1)) {
      atual[parte] ??= {};
      atual = atual[parte] as Record<string, unknown>;
    }
    atual[partes.at(-1)!] = `«${caminho}»`;
  }

  for (const [lista, campos] of Object.entries(catalogo.listas)) {
    // Duas linhas, não uma: bloco que repete só uma vez esconde erro de
    // fechamento — o corpo sairia igual com ou sem a repetição.
    contexto[lista] = [0, 1].map((indice) =>
      Object.fromEntries(campos.map((campo) => [campo, `«${campo}-${indice}»`])),
    );
  }
  return contexto;
};

describe("modelos globais semeados", () => {
  const todos = semeados();

  it("encontra todos os modelos das migrations", () => {
    // O extrator é regex sobre SQL: se parar de achar, os testes abaixo
    // passariam sem conferir nada.
    assert.ok(todos.length >= 15, `só ${todos.length} modelos extraídos`);
  });

  it("cada tipo aparece uma vez só", () => {
    // O índice único parcial (um global por tipo) transformaria repetição em
    // erro de migration na VPS, no meio do deploy.
    const vistos = new Map<string, string>();
    for (const modelo of todos) {
      const antes = vistos.get(modelo.tipo);
      assert.ok(!antes, `${modelo.tipo} semeado em ${antes} e de novo em ${modelo.arquivo}`);
      vistos.set(modelo.tipo, modelo.arquivo);
    }
  });

  for (const modelo of semeados()) {
    describe(`${modelo.tipo} (${modelo.arquivo})`, () => {
      it("declara um escopo conhecido, no módulo dele", () => {
        assert.ok(ehEscopo(modelo.escopo), `escopo ${modelo.escopo} não existe no código`);
        assert.equal(
          modelo.modulo,
          MODULO_DO_ESCOPO[modelo.escopo as EscopoDeDocumento],
          `${modelo.tipo} está no módulo errado para o escopo ${modelo.escopo}`,
        );
      });

      it("o identificador cabe no CHECK da tabela", () => {
        assert.match(modelo.tipo, /^[A-Z][A-Z0-9_]{2,39}$/);
      });

      it("só usa marcadores do catálogo do escopo", () => {
        assert.doesNotThrow(() =>
          validarContraCatalogo(modelo.corpo, CATALOGO_POR_ESCOPO[modelo.escopo as EscopoDeDocumento]));
      });

      it("o sanitizador não remove nada do que foi escrito", () => {
        // Tag fora da lista de permissão sumiria em silêncio, e o padrão do
        // produto sairia com um pedaço a menos sem ninguém perceber.
        assert.deepEqual(tagsRemovidas(modelo.corpo), []);
      });

      it("renderiza sem sobrar marcador cru", () => {
        const corpo = limparCorpo(
          renderizar(modelo.corpo, contextoCompleto(modelo.escopo as EscopoDeDocumento)),
        );
        assert.ok(!corpo.includes("{{"), `sobrou marcador: ${corpo.slice(0, 200)}`);
        assert.ok(corpo.includes("«"), "nenhum marcador foi interpolado");
      });

      it("a lista, quando existe, repete de verdade", () => {
        const catalogo = CATALOGO_POR_ESCOPO[modelo.escopo as EscopoDeDocumento];
        const listas = Object.keys(catalogo.listas);
        if (listas.length === 0 || !listas.some((lista) => modelo.corpo.includes(`{{#${lista}}}`))) {
          return;
        }

        // Tabela com bloco que não repete é a falha clássica: o modelo parece
        // certo e imprime só o primeiro item.
        const corpo = renderizar(modelo.corpo, contextoCompleto(modelo.escopo as EscopoDeDocumento));
        assert.ok(corpo.includes("-0»") && corpo.includes("-1»"), "a lista não repetiu");
      });
    });
  }
});

describe("escopos: código e banco", () => {
  it("o CHECK da migration tem exatamente os escopos do código", () => {
    // Mesma classe de bug da lista de módulos do painel: escopo que existe num
    // lado e não no outro só falha na hora de gravar o modelo.
    //
    // A migration é procurada, e não nomeada: apontar para um arquivo fixo
    // fazia o teste medir um CHECK que outra migration já tinha substituído —
    // ele continuaria verde enquanto o banco recusava o escopo novo.
    const migrations = readdirSync(MIGRATIONS).sort();
    const comCheck = migrations.filter((arquivo) =>
      /CHECK \(escopo IN \(/.test(ler(arquivo)));

    assert.ok(comCheck.length > 0, "nenhuma migration define o CHECK de escopo");

    const ultima = ler(comCheck[comCheck.length - 1]!);
    const check = /CHECK \(escopo IN \(([\s\S]*?)\)\)/.exec(ultima)![1]!;
    const noBanco = [...check.matchAll(/'(\w+)'/g)].map((achado) => achado[1]!);

    assert.deepEqual([...noBanco].sort(), [...ESCOPOS].sort());
  });

  it("todo escopo tem rótulo, referência, catálogo e módulo", () => {
    for (const escopo of ESCOPOS) {
      assert.ok(CATALOGO_POR_ESCOPO[escopo], `${escopo} sem catálogo`);
      assert.ok(MODULO_DO_ESCOPO[escopo], `${escopo} sem módulo`);
      assert.ok(
        CATALOGO_POR_ESCOPO[escopo].valores.length > 0,
        `${escopo} sem marcador nenhum`,
      );
    }
  });

  it("os módulos dos escopos cabem no CHECK de documento_modelo", () => {
    const criacao = ler("0014_documentos.sql");
    const check = /CHECK \(modulo IN \(([\s\S]*?)\)\)/.exec(criacao)![1]!;
    const permitidos = [...check.matchAll(/'(\w+)'/g)].map((achado) => achado[1]!);

    for (const escopo of ESCOPOS) {
      assert.ok(
        permitidos.includes(MODULO_DO_ESCOPO[escopo]),
        `${escopo} aponta para o módulo ${MODULO_DO_ESCOPO[escopo]}, fora do CHECK`,
      );
    }
  });
});
