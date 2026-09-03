import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { responsavelSugerido } from "../../src/domain/checklist/SetorSugerido";

const setor = (id: string, nome: string) => ({ id, nome });

const ORGANOGRAMA = [
  setor("s-cont", "Contabilidade"),
  setor("s-jur", "Procuradoria Jurídica"),
  setor("s-adm", "Secretaria de Administração"),
  setor("s-cpl", "CPL"),
];

describe("resolver o setor que o modelo sugere", () => {
  it("nome igual casa, sem depender de acento ou caixa", () => {
    assert.equal(responsavelSugerido("CONTABILIDADE", ORGANOGRAMA).setorId, "s-cont");
    assert.equal(responsavelSugerido("contabilidade", ORGANOGRAMA).setorId, "s-cont");
    assert.equal(responsavelSugerido("JURÍDICO", [setor("s-j", "Juridico")]).setorId, "s-j");
  });

  it("nome contido casa: 'ADMINISTRAÇÃO' acha 'Secretaria de Administração'", () => {
    // É como as prefeituras cadastram. Exigir o nome exato deixaria em branco
    // justamente os casos mais comuns.
    assert.equal(responsavelSugerido("ADMINISTRAÇÃO", ORGANOGRAMA).setorId, "s-adm");
  });

  it("'A COM B' põe A como responsável e B como apoio", () => {
    const resolvido = responsavelSugerido("CONTABILIDADE COM JURÍDICO", [
      ...ORGANOGRAMA, setor("s-j", "Setor Jurídico"),
    ]);
    assert.equal(resolvido.setorId, "s-cont");
    assert.deepEqual(resolvido.apoios, [{ setorId: "s-j", departamentoId: null }]);
  });

  it("o casamento é literal: 'JURÍDICO' não acha 'Procuradoria Jurídica'", () => {
    /**
     * Limitação conhecida e aceita: a comparação é por texto, e a flexão de
     * gênero muda o texto. Reconhecer "Jurídica" como "JURÍDICO" pediria
     * radicalização de palavra, que erra em outros casos — e errar o
     * responsável é o que não se pode fazer. Fica em branco, como antes.
     */
    assert.equal(responsavelSugerido("JURÍDICO", ORGANOGRAMA).setorId, null);
  });

  it("'A OU B' é um papel só: vale o primeiro que existir", () => {
    const organograma = [setor("s-infra", "Infraestrutura")];
    const resolvido = responsavelSugerido(
      "SECRETARIA DE OBRAS OU INFRAESTRUTURA", organograma,
    );
    assert.equal(resolvido.setorId, "s-infra");
    assert.deepEqual(resolvido.apoios, []);
  });

  it("dois candidatos empatados não escolhem nenhum", () => {
    /**
     * "SAÚDE" diante de "Secretaria de Saúde" e "Fundo Municipal de Saúde" é
     * uma pergunta que só quem trabalha lá responde. Em branco alguém preenche;
     * errado, o item fica cobrado de quem não devia até o prazo vencer.
     */
    const resolvido = responsavelSugerido("SAÚDE", [
      setor("s-sec", "Secretaria de Saúde"),
      setor("s-fun", "Fundo Municipal de Saúde"),
    ]);
    assert.equal(resolvido.setorId, null);
  });

  it("nome exato desempata o que a contenção deixaria ambíguo", () => {
    const resolvido = responsavelSugerido("SAÚDE", [
      setor("s-sau", "Saúde"),
      setor("s-fun", "Fundo Municipal de Saúde"),
    ]);
    assert.equal(resolvido.setorId, "s-sau");
  });

  it("sem sugestão, sem organograma, ou sem casar: em branco", () => {
    assert.deepEqual(responsavelSugerido(null, ORGANOGRAMA), { setorId: null, apoios: [] });
    assert.deepEqual(responsavelSugerido("   ", ORGANOGRAMA), { setorId: null, apoios: [] });
    assert.deepEqual(responsavelSugerido("CONTABILIDADE", []), { setorId: null, apoios: [] });
    assert.equal(responsavelSugerido("TRIBUTOS", ORGANOGRAMA).setorId, null);
  });

  it("apoio que não existe some, e o responsável continua", () => {
    const resolvido = responsavelSugerido(
      "CONTABILIDADE COM SECRETARIA DE CULTURA E DE ESPORTES", ORGANOGRAMA,
    );
    assert.equal(resolvido.setorId, "s-cont");
    assert.deepEqual(resolvido.apoios, []);
  });

  it("apoio igual ao responsável não vira linha repetida", () => {
    // O banco tem chave sobre (item, setor), e a tela mostraria o nome duas
    // vezes. Acontece quando dois nomes da planilha casam com o mesmo setor.
    const resolvido = responsavelSugerido(
      "CPL COM COMISSÃO", [setor("s-cpl", "CPL")],
    );
    assert.equal(resolvido.setorId, "s-cpl");
    assert.deepEqual(resolvido.apoios, []);
  });

  it("as dezessete sugestões da planilha não quebram nenhuma", () => {
    // Varredura: o que importa aqui é nenhuma lançar exceção e nenhuma inventar
    // apoio sobre um organograma vazio.
    const daPlanilha = [
      "CONTABILIDADE", "ADMINISTRAÇÃO", "RECURSOS HUMANOS", "SECRETARIA DE SAÚDE",
      "SECRETARIA DE OBRAS OU INFRAESTRUTURA", "CPL", "CONTABILIDADE COM JURÍDICO",
      "SETOR DE CONTRATOS", "SECRETARIA DE EDUCAÇÃO", "OUVIDORIA COM JURÍDICO",
      "OUVIDORIA", "TRIBUTOS", "RECURSOS HUMANOS COM ADMINISTRAÇÃO", "JURÍDICO",
      "FINANCEIRO", "CPL COM ADMINISTRAÇÃO",
      "CONTABILIDADE COM SECRETARIA DE CULTURA E DE ESPORTES",
    ];
    for (const sugestao of daPlanilha) {
      assert.deepEqual(responsavelSugerido(sugestao, []), { setorId: null, apoios: [] });
    }
  });
});
