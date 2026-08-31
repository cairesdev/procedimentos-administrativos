import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alcanceDe } from "../../src/domain/almoxarifado/AlcanceDeLocais";

describe("quais escolas o usuário alcança", () => {
  it("lotado numa escola, alcança aquela escola", () => {
    const alcance = alcanceDe([{ localId: "escola-1" }]);
    assert.deepEqual(alcance, { tipo: "LOCAIS", locais: ["escola-1"] });
  });

  it("lotado em duas escolas, alcança as duas", () => {
    const alcance = alcanceDe([{ localId: "escola-1" }, { localId: "escola-2" }]);
    assert.deepEqual(alcance, { tipo: "LOCAIS", locais: ["escola-1", "escola-2"] });
  });

  it("a mesma escola duas vezes não vira duas", () => {
    const alcance = alcanceDe([{ localId: "escola-1" }, { localId: "escola-1" }]);
    assert.deepEqual(alcance, { tipo: "LOCAIS", locais: ["escola-1"] });
  });

  it("lotado em setor, alcança pelo setor", () => {
    const alcance = alcanceDe([{ setorId: "setor-1" }]);
    assert.deepEqual(alcance, { tipo: "SETORES", setores: ["setor-1"] });
  });

  it("a escola vence o setor", () => {
    /**
     * Quem acumula os dois é tratado pelo lado mais restrito. O contrário
     * deixaria a trava desligável por acúmulo de lotação: "ganhar acesso a
     * tudo" viraria efeito colateral de um cadastro a mais.
     */
    const alcance = alcanceDe([{ setorId: "setor-1" }, { localId: "escola-1" }]);
    assert.deepEqual(alcance, { tipo: "LOCAIS", locais: ["escola-1"] });
  });

  it("sem lotação, não há trava", () => {
    // O administrador, e o dia da migration: em produção ninguém está lotado
    // em escola ainda, e "não alcança nada" trancaria o módulo no deploy.
    assert.deepEqual(alcanceDe([]), { tipo: "TUDO" });
  });

  it("lotação de unidade ou departamento não trava o estoque", () => {
    // A escola do almoxarifado é `local`. Unidade e departamento são a
    // estrutura administrativa, e não dizem nada sobre onde o material está.
    assert.deepEqual(alcanceDe([{ unidadeId: "u-1" }]), { tipo: "TUDO" });
    assert.deepEqual(alcanceDe([{ departamentoId: "d-1" }]), { tipo: "TUDO" });
  });

  it("lotação sem destino nenhum não inventa alcance", () => {
    assert.deepEqual(alcanceDe([{ localId: null, setorId: null }]), { tipo: "TUDO" });
  });
});
