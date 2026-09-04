import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { ErroDeNegocio } from "../../src/domain/shared/ErroDeNegocio";
import { chaveDoAmbiente, cifrar, decifrar } from "../../src/domain/email/SegredoDoSmtp";
import { enderecoValido, remetenteComNome } from "../../src/domain/email/Remetente";

const CHAVE = randomBytes(32);

describe("a senha do SMTP guardada", () => {
  it("volta igual ao que entrou", () => {
    for (const senha of ["senha simples", "com acento: ção", "s3nh@!#$%&*()_+", "x".repeat(300)]) {
      assert.equal(decifrar(cifrar(senha, CHAVE), CHAVE), senha);
    }
  });

  it("cifrar duas vezes a mesma senha dá pacotes diferentes", () => {
    /**
     * O nonce é sorteado a cada cifra.
     *
     * Sem isso, duas prefeituras com a mesma senha teriam a mesma linha no
     * banco — e quem lesse o dump saberia disso sem decifrar nada. É pouco, e
     * é exatamente o tipo de vazamento que não custa nada evitar.
     */
    const um = cifrar("mesma senha", CHAVE);
    const outro = cifrar("mesma senha", CHAVE);
    assert.notEqual(um, outro);
    assert.equal(decifrar(um, CHAVE), decifrar(outro, CHAVE));
  });

  it("chave errada não devolve lixo — recusa", () => {
    // É o que o GCM compra: adulteração e chave trocada falham alto, em vez de
    // produzir bytes que seguiriam para o servidor de e-mail como se fossem
    // senha.
    const pacote = cifrar("senha", CHAVE);
    assert.throws(() => decifrar(pacote, randomBytes(32)), ErroDeNegocio);
  });

  it("linha adulterada no banco é recusada", () => {
    const bytes = Buffer.from(cifrar("senha", CHAVE), "base64");
    // `writeUInt8` em vez de `bytes[i] ^= …`: o índice devolve `number |
    // undefined` para o TypeScript, e o projeto não usa asserção non-null.
    bytes.writeUInt8(bytes.readUInt8(bytes.length - 1) ^ 0xff, bytes.length - 1);
    assert.throws(() => decifrar(bytes.toString("base64"), CHAVE), /alterada por fora/);
  });

  it("pacote truncado é recusado com a frase que diz o que fazer", () => {
    assert.throws(() => decifrar("YWJj", CHAVE), /Cadastre-a de novo/);
  });

  it("a mensagem do erro não carrega a senha", () => {
    // Erro de cifra vai para o log, e log com senha dentro é o vazamento que a
    // cifra existia para evitar.
    const pacote = cifrar("senha-secreta-do-smtp", CHAVE);
    try {
      decifrar(pacote, randomBytes(32));
      assert.fail("deveria recusar");
    } catch (erro) {
      assert.doesNotMatch((erro as Error).message, /senha-secreta-do-smtp/);
    }
  });
});

describe("a chave do ambiente", () => {
  it("aceita 32 bytes em base64", () => {
    assert.equal(chaveDoAmbiente(CHAVE.toString("base64")).length, 32);
  });

  it("sem chave, diz o comando que gera uma", () => {
    assert.throws(() => chaveDoAmbiente(undefined), /openssl rand -base64 32/);
  });

  it("chave curta é recusada no arranque, não no primeiro envio", () => {
    /**
     * `Buffer.from(x, "base64")` não reclama de entrada inválida — descarta o
     * que não reconhece e devolve um buffer curto. Sem esta conferência, uma
     * chave de dezoito bytes passaria pelo cadastro e explodiria semanas
     * depois, no meio de um envio, com uma mensagem do OpenSSL.
     */
    assert.throws(() => chaveDoAmbiente(randomBytes(18).toString("base64")), /32 bytes/);
    assert.throws(() => chaveDoAmbiente("não é base64 de jeito nenhum"), /32 bytes/);
  });
});

describe("o remetente", () => {
  it("leva o nome da prefeitura na frente", () => {
    assert.equal(
      remetenteComNome("Prefeitura de Monção", "naoresponda@produto.com.br"),
      '"Prefeitura de Monção" <naoresponda@produto.com.br>',
    );
  });

  it("quebra de linha no nome não vira cabeçalho novo", () => {
    /**
     * Injeção de cabeçalho.
     *
     * O nome vem do cadastro do órgão, que um administrador digita. Um `\r\n`
     * ali encerraria o `From:` e o que viesse depois seria lido como cabeçalho
     * — um `Bcc:` inventado, mandando cópia de toda exigência para fora.
     */
    const perigoso = "Prefeitura\r\nBcc: invasor@exemplo.com";
    const cabecalho = remetenteComNome(perigoso, "x@y.com");
    assert.doesNotMatch(cabecalho, /[\r\n]/);
    assert.doesNotMatch(cabecalho, /Bcc:.*\n/);
    assert.equal(cabecalho, '"Prefeitura Bcc: invasor@exemplo.com" <x@y.com>');
  });

  it("aspa no nome não fecha o campo antes da hora", () => {
    assert.equal(remetenteComNome('Prefeitura "X"', "x@y.com"), '"Prefeitura X" <x@y.com>');
  });

  it("nome que sobra vazio vira endereço puro", () => {
    // `From: "" <x@y.com>` é pior que sem nome: alguns clientes mostram a
    // linha crua.
    assert.equal(remetenteComNome('""', "x@y.com"), "x@y.com");
    assert.equal(remetenteComNome("   ", "x@y.com"), "x@y.com");
  });
});

describe("o endereço do destinatário", () => {
  it("aceita o que é endereço de gente de verdade", () => {
    for (const bom of [
      "cidadao@exemplo.com",
      "maria.souza+processo@moncao.ma.gov.br",
      "contato@cartorio.com.br",
      "a_b-c@sub.dominio.org",
    ]) {
      assert.ok(enderecoValido(bom), bom);
    }
  });

  it("recusa o que certamente não é endereço", () => {
    for (const ruim of [
      "", "   ", "Engenheiro da obra", "sem-arroba.com",
      "dois@@arrobas.com", "espaço no@meio.com", "@semlocal.com",
      "semdominio@", "ponto@final.", "duplo@pontos..com",
      "vírgula@lista.com, outro@lista.com",
    ]) {
      assert.ok(!enderecoValido(ruim), `${ruim} deveria ser recusado`);
    }
  });

  it("domínio sem ponto é recusado", () => {
    // `alguem@localhost` é legítimo em rede interna e nunca no cadastro de um
    // fornecedor ou de um cidadão — aqui é campo preenchido errado.
    assert.ok(!enderecoValido("alguem@localhost"));
  });
});
