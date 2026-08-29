import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ApurarConsumo, percentualDeAgriculturaFamiliar,
} from "../../src/application/almoxarifado/ApurarConsumo";
import { recusa } from "../ajudantes/dobras";

/**
 * O relatório de consumo da alimentação escolar.
 *
 * O que ele precisa acertar é o recorte: período válido, almoxarifado do
 * próprio órgão, e a conta do percentual de agricultura familiar. As somas em
 * si vivem em SQL e são conferidas pelo `verificar-migrations.py`, que as
 * submete a um Postgres de verdade.
 */

const montar = () => {
  const gravado = { relatorios: [] as Record<string, unknown>[] };

  const relatorios = {
    criar: async (dados: Record<string, unknown>) => {
      gravado.relatorios.push(dados);
      return `rel-${gravado.relatorios.length}`;
    },
    listar: async () => gravado.relatorios,
    apurar: async (_orgao: string, id: string) =>
      id === "rel-1" ? { id, unidades: [], produtos: [] } : null,
    excluir: async () => {},
  };

  const almoxarifado = {
    buscarAlmoxarifado: async (_orgao: string, id: string) =>
      id === "alm-1" ? { id, nome: "Central", ativo: true } : null,
  };

  return {
    gravado,
    caso: new ApurarConsumo(relatorios as never, almoxarifado as never),
  };
};

const recorte = {
  orgaoId: "org-1",
  usuarioId: "u-1",
  almoxarifadoId: "alm-1",
  periodoInicio: "2026-03-01",
  periodoFim: "2026-03-31",
};

describe("relatório de consumo: o recorte", () => {
  it("guarda o periodo e o almoxarifado pedidos", async () => {
    const { caso, gravado } = montar();
    const { id } = await caso.criar(recorte);

    assert.equal(id, "rel-1");
    assert.equal(gravado.relatorios[0]!.periodoInicio, "2026-03-01");
    assert.equal(gravado.relatorios[0]!.almoxarifadoId, "alm-1");
  });

  it("recusa periodo invertido, e nao grava nada", async () => {
    // Período ao contrário devolveria relatório vazio, e quem presta contas
    // concluiria que não houve movimento — o pior jeito de errar aqui.
    const { caso, gravado } = montar();
    await recusa(
      () => caso.criar({ ...recorte, periodoInicio: "2026-03-31", periodoFim: "2026-03-01" }),
      /antes do começo/,
    );
    assert.equal(gravado.relatorios.length, 0);
  });

  it("aceita periodo de um dia so", async () => {
    const { caso } = montar();
    await caso.criar({ ...recorte, periodoInicio: "2026-03-05", periodoFim: "2026-03-05" });
  });

  it("recusa almoxarifado de outro orgao", async () => {
    // A trava do órgão é o que impede uma prefeitura de apurar o consumo da
    // vizinha por id adivinhado.
    const { caso, gravado } = montar();
    await recusa(
      () => caso.criar({ ...recorte, almoxarifadoId: "alm-de-outra-prefeitura" }),
      /não encontrado/,
    );
    assert.equal(gravado.relatorios.length, 0);
  });

  it("relatorio inexistente nao apura", async () => {
    const { caso } = montar();
    await recusa(() => caso.apurar("org-1", "rel-99"), /não encontrado/);
  });
});

describe("percentual de agricultura familiar", () => {
  it("conta remessas, com uma casa decimal", () => {
    assert.equal(percentualDeAgriculturaFamiliar(10, 3), "30%");
    assert.equal(percentualDeAgriculturaFamiliar(3, 1), "33,3%");
    assert.equal(percentualDeAgriculturaFamiliar(4, 4), "100%");
  });

  it("sem entrada nenhuma, e zero — nao divisao por zero", () => {
    // Período sem remessa é comum (férias escolares), e um NaN na peça
    // impressa seria pior que o número.
    assert.equal(percentualDeAgriculturaFamiliar(0, 0), "0%");
  });
});
