import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cabeNaLicitacao, disponivelNaLicitacao,
} from "../../src/domain/contrato/TetoDaLicitacao";

describe("o teto da licitação", () => {
  it("cabe quando sobra espaço", () => {
    assert.equal(cabeNaLicitacao({ valorLicitacao: 100000, jaContratado: 40000 }, 30000), true);
  });

  it("cabe exatamente no teto", () => {
    // O valor autorizado é o autorizado: gastá-lo por inteiro é o esperado,
    // não um caso de borda a recusar.
    assert.equal(cabeNaLicitacao({ valorLicitacao: 100000, jaContratado: 40000 }, 60000), true);
  });

  it("não cabe um centavo além", () => {
    assert.equal(cabeNaLicitacao({ valorLicitacao: 100000, jaContratado: 40000 }, 60000.01), false);
  });

  it("licitação sem contrato nenhum aceita o valor inteiro", () => {
    assert.equal(cabeNaLicitacao({ valorLicitacao: 50000, jaContratado: 0 }, 50000), true);
  });

  it("licitação esgotada não aceita nem um centavo", () => {
    assert.equal(cabeNaLicitacao({ valorLicitacao: 50000, jaContratado: 50000 }, 0.01), false);
    assert.equal(disponivelNaLicitacao({ valorLicitacao: 50000, jaContratado: 50000 }), 0);
  });

  it("centavos que não fecham em ponto flutuante", () => {
    /**
     * `0.1 + 0.2 > 0.3` em ponto flutuante, e o contrato que fecha exatamente
     * no teto seria recusado por um erro de arredondamento invisível ao
     * usuário — que veria "não cabe" para uma conta que fecha na calculadora.
     */
    assert.equal(cabeNaLicitacao({ valorLicitacao: 0.3, jaContratado: 0.1 }, 0.2), true);
    assert.equal(
      cabeNaLicitacao({ valorLicitacao: 1000.3, jaContratado: 1000.1 }, 0.2), true,
    );
  });

  it("o disponível é o que a mensagem de recusa informa", () => {
    assert.equal(disponivelNaLicitacao({ valorLicitacao: 100000, jaContratado: 40000 }), 60000);
    assert.equal(disponivelNaLicitacao({ valorLicitacao: 0.3, jaContratado: 0.1 }), 0.2);
  });

  it("já contratado acima do teto dá disponível negativo", () => {
    // Acontece com dado antigo, de antes da trava: a tela precisa poder dizer
    // que estourou, em vez de mostrar zero e fingir que está tudo certo.
    assert.equal(disponivelNaLicitacao({ valorLicitacao: 100, jaContratado: 150 }), -50);
  });
});
