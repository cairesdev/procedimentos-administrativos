import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alvoNaTela } from "../src/features/checklists/alvo.ts";

describe("alvo do checklist na tela", () => {
  it("processo aparece pelo número, com link para a fila", () => {
    const alvo = alvoNaTela({
      alvoTipo: "PROCESSO",
      alvoId: "3f2a1b8c-0000-4000-8000-000000000001",
      alvoNumero: "2026/0001",
      alvoRotulo: "Maria da Silva",
    });

    assert.equal(alvo.texto, "processo 2026/0001");
    assert.equal(alvo.detalhe, "Maria da Silva");
    assert.equal(alvo.href, "/processos/fila/3f2a1b8c-0000-4000-8000-000000000001");
    // O que a tela mostrava antes: nunca mais o uuid cru.
    assert.ok(!alvo.texto.includes("3f2a1b8c"));
  });

  it("contrato e licitação levam à própria tela", () => {
    assert.equal(
      alvoNaTela({ alvoTipo: "CONTRATO", alvoId: "abc", alvoNumero: "010/2026" }).href,
      "/processos/contratos/abc",
    );
    assert.equal(
      alvoNaTela({ alvoTipo: "LICITACAO", alvoId: "abc", alvoNumero: "001/2026" }).href,
      "/processos/licitacoes/abc",
    );
  });

  it("fornecedor tem número, mas não tem tela de detalhe", () => {
    // Existe só a listagem. Linkar para ela seria prometer um lugar que não
    // responde a pergunta de quem clicou.
    const alvo = alvoNaTela({
      alvoTipo: "FORNECEDOR", alvoId: "abc",
      alvoNumero: "12.345.678/0001-90", alvoRotulo: "ALFA COMERCIO LTDA",
    });

    assert.equal(alvo.texto, "fornecedor 12.345.678/0001-90");
    assert.equal(alvo.detalhe, "ALFA COMERCIO LTDA");
    assert.equal(alvo.href, null);
  });

  it("sem vínculo é lista avulsa, e não um selo vazio", () => {
    const alvo = alvoNaTela({ alvoTipo: null, alvoId: null });
    assert.equal(alvo.texto, "lista avulsa");
    assert.equal(alvo.tipo, null);
    assert.equal(alvo.href, null);
  });

  it("vínculo órfão diz que está órfão, em vez de sumir", () => {
    // Registro apagado, ou de outra prefeitura: a consulta devolve o tipo sem
    // o número. Esconder o vínculo faria o checklist parecer avulso.
    const alvo = alvoNaTela({ alvoTipo: "PROCESSO", alvoId: "abc", alvoNumero: null });
    assert.equal(alvo.texto, "processo não encontrado");
    assert.equal(alvo.href, null);
  });

  it("tipo desconhecido não quebra a linha", () => {
    // Um tipo novo na API antes da tela conhecer: mostra o que dá, sem link.
    const alvo = alvoNaTela({ alvoTipo: "ATA", alvoId: "abc", alvoNumero: "SRP 5/2026" });
    assert.equal(alvo.texto, "ata SRP 5/2026");
    assert.equal(alvo.href, null);
  });

  it("rótulo em branco não vira detalhe vazio", () => {
    const alvo = alvoNaTela({
      alvoTipo: "CONTRATO", alvoId: "abc", alvoNumero: "010/2026", alvoRotulo: "   ",
    });
    assert.equal(alvo.detalhe, null);
  });
});
