import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  arredondar, ordenarPorValidade, somar, sugerirRetiradas,
} from "../../src/domain/almoxarifado/Fefo";
import { diasAteVencer, situacaoDaValidade } from "../../src/domain/almoxarifado/Validade";
import { recusa } from "../ajudantes/dobras";

const lote = (id: string, saldo: number, dataValidade: string | null = null) =>
  ({ id, saldo, dataValidade });

describe("ordem FEFO", () => {
  it("o que vence primeiro sai primeiro", () => {
    const ordenados = ordenarPorValidade([
      lote("c", 10, "2026-12-01"),
      lote("a", 10, "2026-09-15"),
      lote("b", 10, "2026-10-20"),
    ]);
    assert.deepEqual(ordenados.map((l) => l.id), ["a", "b", "c"]);
  });

  it("lote sem validade vai por último", () => {
    // Material de expediente não vence: não corre risco de perder, então cede
    // a vez para o que corre.
    const ordenados = ordenarPorValidade([
      lote("sem", 10, null),
      lote("com", 10, "2030-01-01"),
    ]);
    assert.deepEqual(ordenados.map((l) => l.id), ["com", "sem"]);
  });

  it("desempata por id, para a tela não mudar sozinha", () => {
    // Sem o desempate, dois lotes com a mesma validade alternariam de posição
    // entre duas chamadas e o almoxarife veria a sugestão trocar ao recarregar.
    const entrada = [lote("z", 5, "2026-05-01"), lote("a", 5, "2026-05-01")];
    assert.deepEqual(ordenarPorValidade(entrada).map((l) => l.id), ["a", "z"]);
    assert.deepEqual(ordenarPorValidade([...entrada].reverse()).map((l) => l.id), ["a", "z"]);
  });

  it("não altera a lista recebida", () => {
    const entrada = [lote("b", 1, "2026-02-01"), lote("a", 1, "2026-01-01")];
    ordenarPorValidade(entrada);
    assert.deepEqual(entrada.map((l) => l.id), ["b", "a"]);
  });
});

describe("distribuição sugerida", () => {
  it("consome o lote que vence antes e completa no seguinte", () => {
    const { retiradas, faltando } = sugerirRetiradas(
      [lote("novo", 100, "2027-01-01"), lote("velho", 30, "2026-01-01")],
      50,
    );
    assert.deepEqual(retiradas, [
      { loteId: "velho", quantidade: 30 },
      { loteId: "novo", quantidade: 20 },
    ]);
    assert.equal(faltando, 0);
  });

  it("atende o que dá e informa o que falta", () => {
    // Atendimento parcial é rotina no almoxarifado. Recusar tudo porque falta
    // um quilo obrigaria o almoxarife a refazer o pedido por fora do sistema.
    const { retiradas, faltando } = sugerirRetiradas([lote("unico", 8, "2026-03-01")], 20);
    assert.deepEqual(retiradas, [{ loteId: "unico", quantidade: 8 }]);
    assert.equal(faltando, 12);
  });

  it("ignora lote sem saldo", () => {
    const { retiradas } = sugerirRetiradas(
      [lote("zerado", 0, "2026-01-01"), lote("cheio", 5, "2027-01-01")],
      3,
    );
    assert.deepEqual(retiradas, [{ loteId: "cheio", quantidade: 3 }]);
  });

  it("sem lote nenhum, falta tudo", () => {
    const { retiradas, faltando } = sugerirRetiradas([], 7);
    assert.deepEqual(retiradas, []);
    assert.equal(faltando, 7);
  });

  it("recusa quantidade zero ou negativa", async () => {
    await recusa(async () => sugerirRetiradas([lote("a", 10)], 0), /maior que zero/);
    await recusa(async () => sugerirRetiradas([lote("a", 10)], -5), /maior que zero/);
  });

  it("não acumula resíduo de ponto flutuante", () => {
    // `NUMERIC(14,3)` no banco e um CHECK que exige `confirmada + perdida =
    // quantidade`: 0.30000000000000004 faria a gravação ser recusada no
    // recebimento, longe de onde o erro nasceu.
    const { retiradas } = sugerirRetiradas(
      [lote("a", 0.1, "2026-01-01"), lote("b", 0.1, "2026-02-01"), lote("c", 0.1, "2026-03-01")],
      0.3,
    );
    assert.equal(somar(retiradas.map((r) => r.quantidade)), 0.3);
  });

  it("arredonda em três casas, como a coluna", () => {
    assert.equal(arredondar(1 / 3), 0.333);
    assert.equal(somar([0.1, 0.2]), 0.3);
  });
});

describe("validade: alerta, nunca bloqueio", () => {
  const hoje = new Date("2026-06-15T15:00:00Z");

  it("conta os dias no fuso do município", () => {
    // O servidor roda em UTC: às 21h de Brasília já é o dia seguinte em
    // Londres, e um lote que vence hoje apareceria como vencido.
    assert.equal(diasAteVencer("2026-06-15", hoje), 0);
    assert.equal(diasAteVencer("2026-06-20", hoje), 5);
    assert.equal(diasAteVencer("2026-06-10", hoje), -5);
    assert.equal(diasAteVencer(null, hoje), null);
  });

  it("às 21h de Brasília ainda é o mesmo dia", () => {
    const noite = new Date("2026-06-16T00:30:00Z"); // 21h30 do dia 15 em SP
    assert.equal(diasAteVencer("2026-06-15", noite), 0);
  });

  it("classifica sem impedir nada", () => {
    assert.equal(situacaoDaValidade(null, hoje), "SEM_VALIDADE");
    assert.equal(situacaoDaValidade("2026-06-01", hoje), "VENCIDO");
    assert.equal(situacaoDaValidade("2026-07-01", hoje), "PROXIMO");
    assert.equal(situacaoDaValidade("2027-01-01", hoje), "OK");
  });

  it("o limiar do alerta é configurável", () => {
    // Prefeitura que compra com pouca antecedência quer alerta mais curto.
    assert.equal(situacaoDaValidade("2026-07-10", hoje, 30), "PROXIMO");
    assert.equal(situacaoDaValidade("2026-07-10", hoje, 7), "OK");
  });
});

/**
 * O driver do Postgres converte `DATE` para um `Date` do JS, e `diasAteVencer`
 * espera texto. O plano de liberacao morria com "dataValidade.slice is not a
 * function" — e o card "Liberar" simplesmente nao aparecia, como se fosse
 * falta de permissao. A correcao esta no `pool.ts`, que devolve DATE como
 * texto; estes testes fixam o contrato que o dominio assume.
 */
describe("validade: o dominio recebe texto, nunca Date", () => {
  const hoje = new Date("2026-08-26T15:00:00Z");

  it("aceita a data pura que o Postgres devolve", () => {
    assert.equal(diasAteVencer("2026-08-26", hoje), 0);
    assert.equal(diasAteVencer("2026-09-05", hoje), 10);
    assert.equal(diasAteVencer("2026-08-20", hoje), -6);
  });

  it("aceita timestamp com hora, cortando no dia", () => {
    assert.equal(diasAteVencer("2026-09-05T00:00:00.000Z", hoje), 10);
  });

  it("um Date cru quebraria — e o tipo do port diz string", () => {
    // Se algum dia alguem remover o parser do pool, esta linha volta a valer.
    assert.throws(() => diasAteVencer(new Date("2026-09-05") as never, hoje));
  });
});

describe("pool: DATE volta como texto", () => {
  it("o driver devolve a data pura sem converter para Date", async () => {
    // O pool le o ambiente ao ser importado, e nao conecta em nenhum banco:
    // aqui interessa so o efeito colateral de registrar o parser.
    process.env.DATABASE_URL ??= "postgres://ninguem@localhost:1/vazio";
    process.env.JWT_SECRET ??= "so-para-carregar-o-modulo";
    await import("../../src/infrastructure/db/pool");

    const { types } = await import("pg");
    const comoOhDriverLe = types.getTypeParser(1082);

    assert.equal(comoOhDriverLe("2026-08-26"), "2026-08-26");
    assert.equal(typeof comoOhDriverLe("2026-08-26"), "string");
  });
});
