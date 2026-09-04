import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conviteDeChecklist, conviteDeFornecedor, exigenciaAoRequerente, protocoloAberto,
} from "../../src/domain/email/Mensagens";

const ORGAO = "Prefeitura Municipal de Monção";

const todas = () => [
  conviteDeFornecedor({
    orgao: ORGAO,
    fornecedor: "ALFA COMÉRCIO DE ALIMENTOS LTDA",
    link: "https://exemplo.gov.br/fornecedor/abc123",
    expiraEm: "2026-10-04T12:00:00.000Z",
  }),
  conviteDeChecklist({
    orgao: ORGAO,
    checklist: "Habilitação da obra da creche",
    destinatario: "Engenheiro responsável",
    link: "https://exemplo.gov.br/checklist/def456",
    expiraEm: new Date("2026-09-30T12:00:00.000Z"),
  }),
  exigenciaAoRequerente({
    orgao: ORGAO,
    requerente: "José da Silva",
    numeroProtocolo: "PROT-2026-0417",
    descricao: "Apresentar cópia do comprovante de residência atualizado.",
    link: "https://exemplo.gov.br/acompanhar/PROT-2026-0417",
    prazoEm: "2026-09-20T12:00:00.000Z",
  }),
  protocoloAberto({
    orgao: ORGAO,
    requerente: "Maria de Fátima",
    numeroProtocolo: "PROT-2026-0418",
    assuntoDoPedido: "Solicitação de poda de árvore",
    link: "https://exemplo.gov.br/acompanhar/PROT-2026-0418",
  }),
];

describe("as mensagens de e-mail", () => {
  it("toda mensagem diz de quem é, o que houve e para onde ir", () => {
    for (const mensagem of todas()) {
      assert.ok(mensagem.assunto.includes("Monção"), mensagem.assunto);
      assert.match(mensagem.corpo, /https:\/\/exemplo\.gov\.br/);
      assert.ok(mensagem.corpo.includes(ORGAO), "o rodapé identifica a prefeitura");
    }
  });

  it("nenhuma pede resposta", () => {
    // A caixa que envia não é lida por ninguém: prometer o contrário deixaria o
    // cidadão esperando por uma resposta que nunca vem.
    for (const mensagem of todas()) {
      assert.match(mensagem.corpo, /não responda a este e-mail/i);
    }
  });

  it("o assunto cabe na linha da caixa de entrada", () => {
    /**
     * Assunto cortado no meio do número de protocolo obriga a abrir a mensagem
     * para saber do que se trata — e quem recebe uma exigência precisa saber
     * disso antes de abrir.
     */
    for (const mensagem of todas()) {
      assert.ok(mensagem.assunto.length <= 78, `${mensagem.assunto.length}: ${mensagem.assunto}`);
      assert.doesNotMatch(mensagem.assunto, /[\r\n]/, "assunto é uma linha só");
    }
  });

  it("é texto puro, sem marcação", () => {
    // `text/plain` é lido em qualquer cliente, no leitor de tela e no celular
    // velho da repartição — e não cai em filtro por parecer marketing.
    for (const mensagem of todas()) {
      assert.doesNotMatch(mensagem.corpo, /<[a-z/]/i);
      assert.doesNotMatch(mensagem.corpo, /\{\{/, "sobrou marcador do motor de documentos");
    }
  });

  it("a exigência põe o prazo por último, que é o que fica", () => {
    const comPrazo = exigenciaAoRequerente({
      orgao: ORGAO,
      requerente: "José",
      numeroProtocolo: "PROT-1",
      descricao: "Faltou o RG.",
      link: "https://x.gov.br/a",
      prazoEm: "2026-09-20T12:00:00.000Z",
    });
    assert.match(comPrazo.corpo, /prazo para responder vai até 20\/09\/2026/);
  });

  it("exigência sem prazo não inventa data", () => {
    /**
     * `prazoDias` é opcional na exigência desde a 0018. Escrever "até
     * Invalid Date" ou uma data chutada seria pior que não falar de prazo — o
     * cidadão organizaria a vida por um número que o sistema não cobra.
     */
    const semPrazo = exigenciaAoRequerente({
      orgao: ORGAO,
      requerente: "José",
      numeroProtocolo: "PROT-1",
      descricao: "Faltou o RG.",
      link: "https://x.gov.br/a",
      prazoEm: null,
    });
    assert.doesNotMatch(semPrazo.corpo, /prazo para responder/);
    assert.doesNotMatch(semPrazo.corpo, /Invalid Date|NaN|undefined|null/);
    assert.match(semPrazo.corpo, /o processo não avança/);
  });

  it("data ilegível não vira 'Invalid Date' no corpo", () => {
    const mensagem = conviteDeFornecedor({
      orgao: ORGAO,
      fornecedor: "ALFA",
      link: "https://x.gov.br/a",
      expiraEm: "isto não é data",
    });
    assert.doesNotMatch(mensagem.corpo, /Invalid Date|NaN/);
  });

  it("o convite de fornecedor avisa que o CNPJ não se edita", () => {
    // O CNPJ é a identidade do registro no cadastro global: editá-lo
    // transformaria o fornecedor em outro. Dizer isso no e-mail evita o
    // telefonema.
    const [convite] = todas();
    assert.match(convite?.corpo ?? "", /CNPJ não pode ser alterado/);
  });
});
