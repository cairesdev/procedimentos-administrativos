import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * O produto do item não volta a ter teto curto.
 *
 * `VARCHAR(150)` era um palpite baixo: a especificação de um item de licitação
 * traz marca, gramatura, embalagem e norma técnica na mesma linha, porque é
 * assim que o edital descreve o que se compra. Quando não cabia, a importação
 * recusava a linha ou alguém abreviava à mão — e o que fica no sistema deixa de
 * ser o que está no edital.
 *
 * O risco de volta é real e silencioso: o `max(150)` é o padrão copiado de
 * todos os outros campos de nome do projeto, e um `produto` novo em qualquer
 * schema nasceria com ele por hábito. O erro só apareceria na hora de colar uma
 * planilha de verdade.
 */

const raiz = path.join(__dirname, "..", "..");

const arquivos = (pasta: string): string[] =>
  readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(entrada.name) ? [caminho] : [];
  });

/** Todo `produto: z.string()...` da API e do web, com o `max` que ele declara. */
const limitesDeProduto = () => {
  const encontrados: { arquivo: string; linha: number; max: number }[] = [];

  for (const pasta of [path.join(raiz, "src"), path.join(raiz, "..", "web", "src")]) {
    for (const caminho of arquivos(pasta)) {
      readFileSync(caminho, "utf8").split("\n").forEach((linha, indice) => {
        if (!/\bproduto:\s*z\.string\(\)/.test(linha)) return;
        const teto = linha.match(/\.max\((\d+)\)/);
        encontrados.push({
          arquivo: caminho.replace(raiz, "").replace(/\\/g, "/"),
          linha: indice + 1,
          max: teto ? Number(teto[1]) : Infinity,
        });
      });
    }
  }
  return encontrados;
};

describe("a especificação do produto", () => {
  it("não é limitada a menos de 2000 caracteres em lugar nenhum", () => {
    const apertados = limitesDeProduto().filter((campo) => campo.max < 2000);

    assert.deepEqual(
      apertados,
      [],
      "produto com teto curto — a especificação do edital não vai caber:\n"
      + apertados.map((c) => `  ${c.arquivo}:${c.linha} → max(${c.max})`).join("\n"),
    );
  });

  it("existe em pelo menos um schema dos dois lados", () => {
    // Guarda contra o teste passar por não achar nada: se o regex parar de
    // casar, ele viraria uma checagem sobre lista vazia.
    const campos = limitesDeProduto();
    assert.ok(campos.length >= 4, `achei só ${campos.length} campo(s) de produto`);
    assert.ok(campos.some((c) => c.arquivo.includes("/web/")), "nenhum no web");
    assert.ok(campos.some((c) => !c.arquivo.includes("/web/")), "nenhum na API");
  });

  it("a coluna do banco é TEXT, e não VARCHAR", () => {
    const migrations = path.join(raiz, "db", "migrations");
    const alteracoes = readdirSync(migrations)
      .sort()
      .map((nome) => readFileSync(path.join(migrations, nome), "utf8"))
      .join("\n");

    for (const tabela of ["item", "ata_item"]) {
      assert.match(
        alteracoes,
        new RegExp(`ALTER TABLE ${tabela}\\s+ALTER COLUMN produto TYPE TEXT`),
        `${tabela}.produto não foi alargada para TEXT`,
      );
    }
  });
});
