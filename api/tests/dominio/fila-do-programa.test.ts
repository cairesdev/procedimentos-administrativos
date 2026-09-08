import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aderencia, diasEntre, periodicidadeApurada, retratoDaFila,
} from "../../src/domain/programa/Espera";
import {
  distribuirPorFaixa, faixaDaIdade, idadeEmAnos,
} from "../../src/domain/programa/FaixaEtaria";

/**
 * O que estes testes protegem é o **número que vai no ofício**.
 *
 * Não é cálculo bonito: é a diferença entre um relatório que descreve a fila e
 * um que a maquia. Cada caso abaixo fixa uma decisão que, invertida, faria o
 * município parecer melhor do que é.
 */

const EM = (texto: string) => new Date(`${texto}T12:00:00Z`);

describe("a média sozinha mente por omissão", () => {
  it("município que atende poucos rápido e deixa muitos parados", () => {
    /**
     * Três atenderam em uma semana; duzentos esperam há meio ano. A média das
     * consumadas é 7 dias — excelente — e a fila é péssima. Por isso os dois
     * números saem juntos, sempre.
     */
    const hoje = EM("2026-09-08");
    const rapidos = Array.from({ length: 3 }, () => ({
      indicadaEm: EM("2026-09-01"), iniciadaEm: EM("2026-09-08"),
    }));
    const parados = Array.from({ length: 200 }, () => ({
      indicadaEm: EM("2026-03-08"), iniciadaEm: null,
    }));

    const retrato = retratoDaFila([...rapidos, ...parados], hoje);

    assert.equal(retrato.mediaAteIniciar, 7, "a média dos atendidos é ótima");
    assert.equal(retrato.naFila, 200, "e duzentos continuam esperando");
    assert.equal(retrato.esperaMaisAntiga, 184);
  });
});

describe("a mediana ao lado da média", () => {
  it("um caso extremo puxa a média e não a mediana", () => {
    // Nove esperaram 10 dias; uma esperou três anos.
    const curtos = Array.from({ length: 9 }, () => ({
      indicadaEm: EM("2026-01-01"), iniciadaEm: EM("2026-01-11"),
    }));
    const extremo = { indicadaEm: EM("2023-01-01"), iniciadaEm: EM("2026-01-01") };

    const retrato = retratoDaFila([...curtos, extremo], EM("2026-09-08"));

    assert.equal(retrato.medianaAteIniciar, 10, "a mediana descreve o caso típico");
    assert.ok(
      retrato.mediaAteIniciar > 100,
      `a média foi puxada pelo extremo (${retrato.mediaAteIniciar})`,
    );
  });
});

describe("a fila viva cresce sozinha", () => {
  it("quem não começou espera até hoje, e não até a última consulta", () => {
    const indicacoes = [{ indicadaEm: EM("2026-06-08"), iniciadaEm: null }];

    assert.equal(retratoDaFila(indicacoes, EM("2026-07-08")).mediaNaFila, 30);
    assert.equal(retratoDaFila(indicacoes, EM("2026-09-08")).mediaNaFila, 92);
  });

  it("fila vazia não vira divisão por zero", () => {
    const retrato = retratoDaFila([], EM("2026-09-08"));
    assert.equal(retrato.naFila, 0);
    assert.equal(retrato.mediaNaFila, 0);
    assert.equal(retrato.mediaAteIniciar, 0);
  });
});

describe("dias entre datas, e o fuso", () => {
  it("conta dias de calendário", () => {
    assert.equal(diasEntre("2026-09-01", "2026-09-08"), 7);
  });

  it("o dia é o local, porque a prefeitura é local", () => {
    /**
     * 23h de 1º de setembro em UTC já é dia 2 lá fora, e ainda é dia 1 em
     * Brasília. A sessão das 20h de terça aconteceu na terça para todo mundo
     * que estava na sala — é esse dia que o relatório conta.
     */
    const noiteDeUmDia = new Date("2026-09-01T23:00:00Z");
    const madrugadaSeguinteEmUtc = new Date("2026-09-02T01:00:00Z");
    assert.equal(diasEntre(noiteDeUmDia, madrugadaSeguinteEmUtc), 0);
  });

  it("data de calendário não anda um dia para trás", () => {
    /**
     * `new Date("2026-09-09")` é meia-noite **UTC**, que em Brasília é 8 de
     * setembro às 21h. Sem tratar isso, toda data do módulo andava um dia — e
     * a criança de 3 anos e 364 dias entrava na faixa dos 4 no relatório que
     * vai para a Promotoria.
     */
    assert.equal(diasEntre("2026-09-08", "2026-09-09"), 1);
    assert.equal(idadeEmAnos("2020-09-09", EM("2026-09-08")), 5);
    assert.equal(idadeEmAnos("2020-09-08", EM("2026-09-08")), 6);
  });
});

describe("a idade em anos completos", () => {
  it("quem não fez aniversário ainda tem um ano a menos", () => {
    assert.equal(idadeEmAnos("2020-12-25", EM("2026-09-08")), 5);
    assert.equal(idadeEmAnos("2020-09-08", EM("2026-09-08")), 6);
    assert.equal(idadeEmAnos("2020-09-09", EM("2026-09-08")), 5);
  });

  it("a criança de 3 anos e 11 meses não cai na faixa dos 4", () => {
    // É o erro clássico de dividir por 365,25, e ele muda a linha do relatório.
    const idade = idadeEmAnos("2022-10-08", EM("2026-09-08"));
    assert.equal(idade, 3);
    assert.equal(faixaDaIdade(idade)?.chave, "ate_3");
  });
});

describe("a distribuição por faixa", () => {
  it("mantém a faixa vazia na lista", () => {
    /**
     * Sumir com a faixa faria o relatório parecer que o município não tem
     * adulto com TEA, quando o que ele não tem é adulto com TEA **cadastrado**
     * — que é justamente o que está sendo investigado.
     */
    const linhas = distribuirPorFaixa(["2022-01-01"], EM("2026-09-08"));
    const adulto = linhas.find((linha) => linha.chave === "adulto");
    assert.ok(adulto, "a faixa adulta sumiu da lista");
    assert.equal(adulto.quantidade, 0);
  });

  it("quem não tem data de nascimento vira linha própria", () => {
    // O cadastro do paciente aceita nascimento em branco — o pronto
    // atendimento não pode travar por falta dele. No relatório isso aparece,
    // em vez de sumir dentro de outra faixa e fazer o total não fechar.
    const linhas = distribuirPorFaixa([null, "2015-01-01", null], EM("2026-09-08"));
    const sem = linhas.find((linha) => linha.chave === "sem_nascimento");
    assert.equal(sem?.quantidade, 2);
  });

  it("o total sempre fecha com o que entrou", () => {
    const nascimentos = ["2024-01-01", "2019-01-01", "2010-01-01", "1990-01-01", null];
    const linhas = distribuirPorFaixa(nascimentos, EM("2026-09-08"));
    const total = linhas.reduce((soma, linha) => soma + linha.quantidade, 0);
    assert.equal(total, nascimentos.length);
  });
});

describe("a periodicidade apurada", () => {
  it("conta só o que aconteceu, em sessões por semana", () => {
    // 24 sessões em 84 dias = 12 semanas = 2 por semana.
    assert.equal(periodicidadeApurada(24, 84), 2);
  });

  it("janela sem dias não vira divisão por zero", () => {
    assert.equal(periodicidadeApurada(10, 0), 0);
  });
});

describe("a aderência ao que foi combinado", () => {
  it("metade do combinado é cinquenta por cento", () => {
    assert.equal(aderencia(2, 1), 50);
  });

  it("sem combinado, não inventa cem por cento", () => {
    /**
     * Indicação sem periodicidade combinada apareceria como oferta cumprida,
     * que é o oposto da verdade. `null` faz o relatório dizer "não informada".
     */
    assert.equal(aderencia(null, 1.5), null);
    assert.equal(aderencia(0, 1.5), null);
  });
});
