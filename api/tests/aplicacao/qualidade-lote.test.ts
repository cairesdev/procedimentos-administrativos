import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { RegistrarQualidade } from "../../src/application/almoxarifado/RegistrarQualidade";
import { auditoriaFalsa, recusa } from "../ajudantes/dobras";

/**
 * Registro de qualidade do material armazenado.
 *
 * Existia no legado e foi adiado no levantamento. É acompanhamento — caixa
 * amassada, lote perto de vencer, câmara fria que oscilou — e **não movimenta
 * saldo**: quem tira material do estoque é o ajuste, que exige motivo.
 *
 * Misturar as duas coisas faria um relato de avaria sumir com o material sem
 * ninguém pedir; e, pior, faria quem só quis anotar hesitar em anotar.
 */

const montar = (doOrgao = true) => {
  const gravado = { registros: [] as Record<string, unknown>[] };
  const auditoria = auditoriaFalsa();

  const qualidade = {
    registrar: async (dados: Record<string, unknown>) => {
      gravado.registros.push(dados);
      return `q-${gravado.registros.length}`;
    },
    listar: async () => gravado.registros,
    loteDoOrgao: async () => doOrgao,
  };

  return {
    gravado,
    auditados: auditoria.registros,
    caso: new RegistrarQualidade(qualidade as never, auditoria.porta as never),
  };
};

const base = {
  orgaoId: "org-1",
  usuarioId: "u-1",
  tipo: "DANO" as const,
  observacao: "Duas caixas chegaram amassadas",
};

describe("registro de qualidade", () => {
  it("grava o acompanhamento do lote do almoxarifado", async () => {
    const { caso, gravado, auditados } = montar();
    const { id } = await caso.registrar({ ...base, loteId: "lote-1" });

    assert.equal(id, "q-1");
    assert.equal(gravado.registros[0]!.loteId, "lote-1");
    assert.equal(auditados[0]!.tipoEvento, "QUALIDADE_REGISTRADA");
  });

  it("grava também no armário da unidade", async () => {
    // A escola que recebeu a caixa amassada é quem a vê primeiro.
    const { caso, gravado } = montar();
    await caso.registrar({ ...base, estoqueLocalId: "el-1" });
    assert.equal(gravado.registros[0]!.estoqueLocalId, "el-1");
  });

  it("a quantidade afetada é opcional", async () => {
    // "A câmara fria oscilou" não tem quantidade, e é informação legítima.
    const { caso, gravado } = montar();
    await caso.registrar({
      ...base, loteId: "lote-1", tipo: "ARMAZENAMENTO",
      observacao: "Câmara fria oscilou durante a madrugada",
    });
    assert.equal(gravado.registros[0]!.quantidade, undefined);
  });

  it("aceita a quantidade quando ela existe", async () => {
    const { caso, gravado } = montar();
    await caso.registrar({ ...base, loteId: "lote-1", quantidade: 2 });
    assert.equal(gravado.registros[0]!.quantidade, 2);
  });
});

describe("o que o registro recusa", () => {
  it("os dois lados ao mesmo tempo", async () => {
    // O material está num lugar só: no almoxarifado ou no armário da escola.
    const { caso, gravado } = montar();
    await recusa(
      () => caso.registrar({ ...base, loteId: "lote-1", estoqueLocalId: "el-1" }),
      /nunca os dois/,
    );
    assert.equal(gravado.registros.length, 0);
  });

  it("nenhum dos dois", async () => {
    const { caso, gravado } = montar();
    await recusa(() => caso.registrar(base), /nunca os dois/);
    assert.equal(gravado.registros.length, 0);
  });

  it("observação vazia ou curta demais", async () => {
    // O tipo sozinho não conta a história: "DANO" sem texto é uma linha
    // dizendo que algo aconteceu, sem dizer o quê.
    const { caso, gravado } = montar();
    await recusa(
      () => caso.registrar({ ...base, loteId: "lote-1", observacao: "  " }),
      /Descreva/,
    );
    await recusa(
      () => caso.registrar({ ...base, loteId: "lote-1", observacao: "ok" }),
      /Descreva/,
    );
    assert.equal(gravado.registros.length, 0);
  });

  it("quantidade zero ou negativa", async () => {
    const { caso, gravado } = montar();
    await recusa(
      () => caso.registrar({ ...base, loteId: "lote-1", quantidade: 0 }),
      /maior que zero/,
    );
    assert.equal(gravado.registros.length, 0);
  });

  it("lote de outra prefeitura", async () => {
    // A trava do órgão: um id adivinhado não pode virar registro no estoque
    // da vizinha.
    const { caso, gravado } = montar(false);
    await recusa(
      () => caso.registrar({ ...base, loteId: "lote-de-outra" }),
      /não encontrado/,
    );
    assert.equal(gravado.registros.length, 0);
  });
});

describe("qualidade não mexe em saldo", () => {
  it("o caso de uso não importa o repositório de estoque", () => {
    // Garantia estrutural, e não por texto: o arquivo não conhece o port que
    // sabe debitar saldo. Quem tira material do estoque é o ajuste.
    const fonte = readFileSync(
      path.join(__dirname, "..", "..", "src", "application", "almoxarifado",
        "RegistrarQualidade.ts"),
      "utf8",
    );
    const imports = fonte.slice(0, fonte.indexOf("export const"));

    assert.ok(!/AlmoxarifadoRepository/.test(imports), "importa o repositório de estoque");
    assert.ok(!/MovimentarEstoque/.test(imports), "importa o caso de uso de movimento");
  });
});
