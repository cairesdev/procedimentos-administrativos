import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conferirSinais, pressaoEscrita } from "../../src/domain/saude/SinaisVitais";

/**
 * A diferença entre recusar e avisar.
 *
 * Este é o teste que mais importa do módulo, e não pelo cálculo: ele fixa a
 * decisão de que **valor grave passa**. A tentação de transformar o aviso em
 * trava aparece na primeira revisão de código — "saturação 71 não deveria
 * entrar?" — e a resposta é que um formulário que recusa 71% obriga o
 * enfermeiro a escrever 91% para conseguir salvar.
 */

describe("o que é impossível é recusado", () => {
  it("temperatura de 368 graus é dedo no teclado", () => {
    const { erros } = conferirSinais({ temperatura: 368 });
    assert.equal(erros.length, 1);
    assert.match(erros[0]!, /fora do que é possível/);
  });

  it("pulso de 800 não existe em ser humano", () => {
    assert.equal(conferirSinais({ pulso: 800 }).erros.length, 1);
  });

  it("saturação acima de 100% não existe", () => {
    assert.equal(conferirSinais({ saturacao: 120 }).erros.length, 1);
  });

  it("diastólica maior que sistólica são os campos trocados", () => {
    // Os dois números são plausíveis sozinhos; só a relação entre eles
    // denuncia a inversão, e ela passaria calada para o prontuário.
    const { erros } = conferirSinais({ paSistolica: 80, paDiastolica: 120 });
    assert.equal(erros.length, 1);
    assert.match(erros[0]!, /trocados/);
  });
});

describe("o que é grave passa, com aviso", () => {
  it("saturação 71% entra", () => {
    const { erros, avisos } = conferirSinais({ saturacao: 71 });
    assert.deepEqual(erros, []);
    assert.equal(avisos.length, 1);
  });

  it("temperatura 41,5 °C entra", () => {
    const { erros, avisos } = conferirSinais({ temperatura: 41.5 });
    assert.deepEqual(erros, []);
    assert.equal(avisos.length, 1);
  });

  it("glicemia 480 entra", () => {
    assert.deepEqual(conferirSinais({ glicemia: 480 }).erros, []);
  });

  it("hipertensão grave entra sem erro", () => {
    const { erros, avisos } = conferirSinais({ paSistolica: 220, paDiastolica: 130 });
    assert.deepEqual(erros, []);
    assert.equal(avisos.length, 2);
  });
});

describe("o normal não incomoda ninguém", () => {
  it("uma triagem comum não gera aviso nenhum", () => {
    const conferido = conferirSinais({
      glicemia: 95, paSistolica: 120, paDiastolica: 80,
      pulso: 72, saturacao: 98, temperatura: 36.5,
    });
    assert.deepEqual(conferido.erros, []);
    assert.deepEqual(conferido.avisos, []);
  });

  it("campo não medido é ignorado", () => {
    // O paciente que chega em parada não espera alguém medir glicemia.
    const conferido = conferirSinais({ temperatura: null, pulso: undefined });
    assert.deepEqual(conferido.erros, []);
    assert.deepEqual(conferido.avisos, []);
  });
});

describe("todos os erros de uma vez", () => {
  it("o enfermeiro digita cinco campos e recebe as cinco críticas juntas", () => {
    const { erros } = conferirSinais({ temperatura: 368, pulso: 800, saturacao: 120 });
    assert.equal(erros.length, 3);
  });
});

describe("a pressão escrita para a ficha impressa", () => {
  it("junta os dois números", () => {
    assert.equal(pressaoEscrita(120, 80), "120 × 80");
  });

  it("sem medida, não inventa", () => {
    assert.equal(pressaoEscrita(null, 80), "");
    assert.equal(pressaoEscrita(120, null), "");
  });
});
