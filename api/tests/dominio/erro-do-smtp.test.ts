import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { avisoDePortaETls, explicarErroDoSmtp } from "../../src/domain/email/ErroDoSmtp";

/** O erro exato que apareceu na tela, copiado do relato. */
const WRONG_VERSION =
  "58B21C639A770000:error:0A00010B:SSL routines:tls_validate_record_header:"
  + "wrong version number:../deps/openssl/openssl/ssl/record/methods/tlsany_meth.c:77:";

describe("o erro do SMTP traduzido", () => {
  it("explica o 'wrong version number' que apareceu de verdade", () => {
    /**
     * O caso que motivou este arquivo.
     *
     * A mensagem original é do OpenSSL e fala com quem escreve código. Quem
     * está na tela é um administrador de prefeitura, e nada ali diz que ele
     * marcou TLS direto numa porta de STARTTLS.
     */
    const frase = explicarErroDoSmtp(new Error(WRONG_VERSION), {
      porta: 587, tlsDireto: true,
    });

    assert.match(frase, /TLS direto/);
    assert.match(frase, /STARTTLS/);
    assert.match(frase, /587/);
  });

  it("o texto original nunca é jogado fora", () => {
    /**
     * A tradução resolve o caso conhecido; o texto cru é o que salva quando o
     * caso não é nenhum dos previstos. Trocar um pelo outro seria repetir o
     * erro que esta função existe para corrigir.
     */
    const frase = explicarErroDoSmtp(new Error(WRONG_VERSION), {
      porta: 587, tlsDireto: true,
    });
    assert.match(frase, /o servidor disse:/);
    assert.match(frase, /wrong version number/);
  });

  it("aponta a direção contrária quando o TLS está desligado", () => {
    const frase = explicarErroDoSmtp(new Error(WRONG_VERSION), {
      porta: 465, tlsDireto: false,
    });
    assert.match(frase, /TLS direto/);
    assert.match(frase, /465/);
  });

  it("traduz os outros erros que a prefeitura vai encontrar", () => {
    const casos: [string, RegExp][] = [
      ["Invalid login: 535 5.7.8 Username and Password not accepted", /senha de aplicativo/],
      ["connect ECONNREFUSED 10.0.0.5:587", /Nada atende na porta 587/],
      ["Connection timeout", /firewall/],
      ["getaddrinfo ENOTFOUND smtp.errado.com", /erro de digitação/],
      ["550 5.7.1 Relay access denied", /mesmo da conta autenticada/],
      ["self-signed certificate in certificate chain", /certificado/],
      ["530 5.7.0 Authentication required", /Preencha usuário e senha/],
    ];

    for (const [original, esperado] of casos) {
      const frase = explicarErroDoSmtp(new Error(original), { porta: 587, tlsDireto: false });
      assert.match(frase, esperado, `não traduziu: ${original}`);
      assert.ok(frase.includes(original.slice(0, 30)), "perdeu o texto original");
    }
  });

  it("erro desconhecido volta cru, e não vira 'falha no envio'", () => {
    // Genérico apagaria a única pista existente. Sem tradução, o texto do
    // servidor é melhor que qualquer resumo nosso.
    const estranho = "421 4.7.0 Try again later, closing connection";
    assert.equal(
      explicarErroDoSmtp(new Error(estranho), { porta: 587, tlsDireto: false }),
      estranho,
    );
  });
});

describe("o aviso de porta e criptografia", () => {
  it("avisa nas três combinações que quase sempre estão erradas", () => {
    assert.match(avisoDePortaETls(587, true) ?? "", /STARTTLS/);
    assert.match(avisoDePortaETls(465, false) ?? "", /TLS direto/);
    assert.match(avisoDePortaETls(25, true) ?? "", /porta 25/);
  });

  it("cala nas combinações certas e nas incomuns", () => {
    // Aviso, e não trava: existe servidor interno em porta fora do
    // convencional, e falar onde não se sabe vira ruído que ninguém lê.
    for (const [porta, tls] of [[587, false], [465, true], [25, false], [2525, false]] as const) {
      assert.equal(avisoDePortaETls(porta, tls), null, `${porta}/${tls}`);
    }
  });

  it("o web repete o mesmo texto da API", () => {
    /**
     * A cópia é consciente — o aviso precisa aparecer enquanto a pessoa digita,
     * sem ida ao servidor. Mas cópia que diverge é pior que cópia: a tela
     * diria uma coisa e o erro do envio, outra.
     */
    const web = readFileSync(
      path.join(
        __dirname, "..", "..", "..", "web", "src", "features", "system-admin",
        "components", "aviso-de-porta.ts",
      ),
      "utf8",
    );

    for (const porta of [587, 465, 25] as const) {
      const daApi = avisoDePortaETls(porta, porta !== 465);
      assert.ok(daApi, `sem aviso para ${porta}`);
      // A primeira frase basta: é o que identifica o texto sem prender o teste
      // à pontuação.
      const trecho = daApi.split(".")[0]!;
      assert.ok(
        web.includes(trecho),
        `o web não repete o aviso da porta ${porta}: "${trecho}"`,
      );
    }
  });
});
