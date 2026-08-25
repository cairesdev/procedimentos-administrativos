import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POR_PAGINA_MAXIMO, POR_PAGINA_PADRAO, deslocamentoDe, montarPagina,
} from "../../src/application/shared/Paginacao";
import { paginacaoSchema } from "../../src/interface/http/schemas/paginacao";

const linha = (id: string, total: number) => ({ id, _total: String(total) });

describe("envelope paginado", () => {
  it("converte página em deslocamento", () => {
    assert.equal(deslocamentoDe({ pagina: 1, porPagina: 25 }), 0);
    assert.equal(deslocamentoDe({ pagina: 2, porPagina: 25 }), 25);
    assert.equal(deslocamentoDe({ pagina: 4, porPagina: 10 }), 30);
  });

  it("separa o total da janela e não vaza a coluna de apoio", () => {
    const pagina = montarPagina([linha("a", 57), linha("b", 57)], { pagina: 2, porPagina: 25 });
    assert.deepEqual(pagina, {
      itens: [{ id: "a" }, { id: "b" }], total: 57, pagina: 2, porPagina: 25,
    });
    assert.ok(!("_total" in pagina.itens[0]!), "_total vazou para o cliente");
  });

  it("o COUNT do Postgres vem como texto e sai como número", () => {
    assert.strictEqual(montarPagina([linha("a", 3)], { pagina: 1, porPagina: 25 }).total, 3);
  });

  it("lista vazia não quebra", () => {
    assert.deepEqual(montarPagina([], { pagina: 1, porPagina: 25 }), {
      itens: [], total: 0, pagina: 1, porPagina: 25,
    });
  });
});

describe("parâmetros de paginação na query", () => {
  it("aplica padrão e coerção", () => {
    assert.deepEqual(paginacaoSchema.parse({}), { pagina: 1, porPagina: POR_PAGINA_PADRAO });
    assert.deepEqual(
      paginacaoSchema.parse({ pagina: "3", porPagina: "10" }),
      { pagina: 3, porPagina: 10 },
    );
  });

  it("ignora os outros filtros da mesma query", () => {
    // A rota entrega `req.query` inteiro; o schema pega só o que é dele.
    assert.deepEqual(
      paginacaoSchema.parse({ situacao: "ENVIADA", unidade: "abc", pagina: "2" }),
      { pagina: 2, porPagina: POR_PAGINA_PADRAO },
    );
  });

  it("recusa valor fora da faixa", () => {
    // O teto existe para o cliente não pedir a tabela inteira de uma vez.
    for (const ruim of [
      { pagina: "0" }, { pagina: "-1" }, { pagina: "abc" }, { pagina: "1.5" },
      { porPagina: "0" }, { porPagina: String(POR_PAGINA_MAXIMO + 1) },
    ]) {
      assert.equal(
        paginacaoSchema.safeParse(ruim).success,
        false,
        `deveria recusar ${JSON.stringify(ruim)}`,
      );
    }
  });
});
