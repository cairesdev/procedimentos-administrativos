import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * O worker sobe com o que o compose lhe dá — e nada mais.
 *
 * O teste que faltava. O worker de e-mail ficou **22 horas reiniciando em
 * laço** em produção porque `pool.ts` importa `config/env.ts`, que exigia
 * `JWT_SECRET` no import, e o serviço `email-worker` não declara essa variável
 * — nem deveria: ele não emite token nenhum.
 *
 * Nada acusou. O guarda de `variaveis-no-compose.test.ts` conferia só o serviço
 * `api`, então a suíte ficou verde com a fila parada e a tela dizendo
 * "e-mails esperando o próximo envio", que parece normal.
 *
 * **O teste liga o processo de verdade**, com exatamente as variáveis que o
 * compose declara para ele. Conferência estática não pegaria: o que quebra é a
 * cadeia de imports, e ela só existe em tempo de execução.
 */

const RAIZ = path.join(__dirname, "..", "..");
const PROJETO = path.join(RAIZ, "..");

/** As variáveis que um serviço declara no compose, com os defaults resolvidos. */
const ambienteDoServico = (compose: string, servico: string): Record<string, string> => {
  const texto = readFileSync(path.join(PROJETO, compose), "utf8");

  const inicio = texto.indexOf(`\n  ${servico}:`);
  assert.ok(inicio > 0, `${compose}: serviço ${servico} não encontrado`);

  const resto = texto.slice(inicio + servico.length + 4);
  const fim = resto.search(/\n {2}[a-z][\w-]*:/);
  const bloco = fim > 0 ? resto.slice(0, fim) : resto;

  const ambiente: Record<string, string> = {};
  for (const linha of bloco.split("\n")) {
    const achado = /^ {6}([A-Z][A-Z0-9_]*):\s*(.+)$/.exec(linha);
    if (!achado) continue;

    // `${VAR:-padrao}` e `${VAR:?mensagem}` viram um valor qualquer: o que se
    // testa é a **presença** da variável, não o conteúdo dela.
    ambiente[achado[1]!] = "valor-de-teste";
  }
  return ambiente;
};

describe("o worker de e-mail sobe com o ambiente do compose", () => {
  for (const compose of ["docker-compose.yml", "docker-compose.prod.yml"]) {
    it(`${compose}: a cadeia de imports do worker não exige nada a mais`, () => {
      const declaradas = ambienteDoServico(compose, "email-worker");

      assert.ok(
        "DATABASE_URL" in declaradas && "EMAIL_CHAVE" in declaradas,
        `${compose}: o worker precisa ao menos de DATABASE_URL e EMAIL_CHAVE`,
      );

      /**
       * Importa o que o worker importa, com o ambiente **limpo**.
       *
       * `PATH` e `HOME` entram porque sem eles o Node não roda; o resto é só o
       * que o compose declara. Se algum módulo dessa cadeia exigir uma
       * variável que o serviço não tem, o import estoura aqui — que é
       * exatamente o que aconteceu na VPS.
       *
       * `dotenv/config` é desligado: em desenvolvimento existe um `.env` na
       * raiz da API que preencheria as variáveis e esconderia o defeito, e o
       * contêiner não tem esse arquivo.
       */
      const ambiente = {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        DOTENV_CONFIG_PATH: "/dev/null",
        ...declaradas,
        // Com um valor plausível, para o caso de alguém validar o formato.
        EMAIL_CHAVE: Buffer.alloc(32, 7).toString("base64"),
        DATABASE_URL: "postgresql://ninguem@127.0.0.1:1/nada",
      };

      const importar = [
        "./src/infrastructure/db/pool.ts",
        "./src/infrastructure/db/PostgresEmailFilaRepository.ts",
        "./src/infrastructure/db/PostgresConfiguracaoEmailRepository.ts",
        "./src/infrastructure/email/SmtpEnviador.ts",
        "./src/application/email/DespacharFilaDeEmails.ts",
        "./src/domain/email/SegredoDoSmtp.ts",
        "./src/domain/email/RitmoDoWorker.ts",
      ]
        .map((caminho) => `import(${JSON.stringify(caminho)})`)
        .join(",");

      try {
        execFileSync(
          "npx",
          ["tsx", "-e", `Promise.all([${importar}]).then(() => process.exit(0));`],
          { cwd: RAIZ, env: ambiente, stdio: "pipe", timeout: 120_000 },
        );
      } catch (erro) {
        const saida = String((erro as { stderr?: Buffer }).stderr ?? erro);
        assert.fail(
          `${compose}: o worker não sobe com o ambiente que o serviço declara.\n`
          + "Declare a variável no serviço, ou tire a exigência de quem não a usa.\n"
          + saida.slice(-600),
        );
      }
    });
  }

  it("a API continua exigindo o segredo no arranque", () => {
    /**
     * O outro lado da moeda.
     *
     * Tornar as variáveis preguiçosas fez o worker subir — e abriria a porta
     * para a API subir sem `JWT_SECRET` e só quebrar no primeiro login, de
     * manhã, com gente esperando. `validarParaApi()` fecha essa porta, e este
     * teste garante que ela continue fechada.
     */
    const servidor = readFileSync(path.join(RAIZ, "src", "server.ts"), "utf8");
    assert.match(servidor, /validarParaApi\(\)/, "server.ts não valida o ambiente");

    const env = readFileSync(path.join(RAIZ, "src", "config", "env.ts"), "utf8");
    assert.match(env, /JWT_SECRET/, "validarParaApi não cobra JWT_SECRET");
  });
});
