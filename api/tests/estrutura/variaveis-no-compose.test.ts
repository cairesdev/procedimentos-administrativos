import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Variável que o código lê tem de chegar ao contêiner.
 *
 * Foi assim que a `EMAIL_CHAVE` se perdeu: cadastrada no `.env.prod`, ausente
 * do `environment:` do serviço. **O Compose não repassa o `.env` inteiro para
 * dentro do contêiner** — ele só injeta o que está declarado no serviço, e o
 * resto fica de fora, calado. `process.env.EMAIL_CHAVE` chegava `undefined`, a
 * tela do administrativo geral estourava ao salvar, e o `.env.prod` estava
 * "certo".
 *
 * `APP_URL` tinha o mesmo buraco, e pior: ela não estoura. Vazia, ela produz
 * link de convite e código de conferência apontando para lugar nenhum — quem
 * recebe o e-mail clica e não vai a lugar algum, e ninguém percebe do lado de
 * cá.
 *
 * O teste lê `process.env.X` do código da API e cobra a presença em cada
 * compose. É estático de propósito: falha no CI, antes do deploy.
 */

const RAIZ = path.join(__dirname, "..", "..");
const PROJETO = path.join(RAIZ, "..");

const ler = (caminho: string) => readFileSync(caminho, "utf8");

/**
 * Lidas fora do processo da API, ou só em teste/script.
 *
 * Cada uma some da conferência, então a lista é curta e justificada — é aqui
 * que a próxima variável esquecida se esconderia.
 */
const FORA_DO_COMPOSE: Record<string, string> = {
  NODE_ENV: "posta pelo runtime, não pelo compose",
  EMAIL_INTERVALO_MS: "só o worker usa, e ele já a declara com default",
  EMAIL_LOTE: "só o worker usa, e ele já a declara com default",
};

const usadasNoCodigo = (): string[] => {
  const arquivos: string[] = [];
  const varrer = (pasta: string): void => {
    for (const entrada of require("node:fs").readdirSync(pasta, { withFileTypes: true })) {
      const caminho = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) varrer(caminho);
      else if (entrada.name.endsWith(".ts")) arquivos.push(caminho);
    }
  };
  varrer(path.join(RAIZ, "src"));

  const nomes = new Set<string>();
  for (const arquivo of arquivos) {
    for (const achado of ler(arquivo).matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      nomes.add(achado[1]!);
    }
  }
  return [...nomes].filter((nome) => !(nome in FORA_DO_COMPOSE)).sort();
};

describe("as variáveis de ambiente chegam ao contêiner", () => {
  const usadas = usadasNoCodigo();

  it("acha as variáveis para conferir", () => {
    assert.ok(usadas.length > 5, `só ${usadas.length} — a varredura parou de achar`);
    assert.ok(usadas.includes("EMAIL_CHAVE"), "a que motivou este teste sumiu");
    assert.ok(usadas.includes("APP_URL"));
  });

  for (const compose of ["docker-compose.yml", "docker-compose.prod.yml"]) {
    it(`${compose} declara todas para a API`, () => {
      /**
       * Recorta o serviço `api`, e não o arquivo inteiro.
       *
       * Uma variável declarada no `email-worker` não serve à API, e conferir o
       * arquivo todo deixaria passar exatamente o caso que quebrou.
       */
      const texto = ler(path.join(PROJETO, compose));
      const inicio = texto.indexOf("\n  api:");
      assert.ok(inicio > 0, `${compose}: serviço api não encontrado`);

      const proximo = texto.slice(inicio + 8).search(/\n {2}[a-z][\w-]*:/);
      const servico = texto.slice(inicio, proximo > 0 ? inicio + 8 + proximo : undefined);

      for (const nome of usadas) {
        assert.ok(
          servico.includes(`${nome}:`),
          `${compose} → serviço api: falta ${nome}. `
          + "Pôr no .env não basta: o Compose só injeta o que está no `environment:`.",
        );
      }
    });
  }

  it("o worker de e-mail existe nos dois composes, com a chave", () => {
    // Sem `EMAIL_CHAVE` ele não sobe — de propósito. Sem o serviço, a fila
    // enche e ninguém manda nada.
    for (const compose of ["docker-compose.yml", "docker-compose.prod.yml"]) {
      const texto = ler(path.join(PROJETO, compose));
      assert.match(texto, /\n {2}email-worker:/, `${compose}: sem o serviço email-worker`);

      const inicio = texto.indexOf("\n  email-worker:");
      const proximo = texto.slice(inicio + 17).search(/\n {2}[a-z][\w-]*:/);
      const servico = texto.slice(inicio, proximo > 0 ? inicio + 17 + proximo : undefined);

      assert.match(servico, /EMAIL_CHAVE:/, `${compose}: worker sem EMAIL_CHAVE`);
      assert.match(servico, /dist\/worker\.js/, `${compose}: worker sem o comando certo`);
    }
  });

  it("o .env.example documenta o que os composes exigem", () => {
    // Variável obrigatória (`:?`) sem linha no exemplo é deploy que só falha na
    // VPS, com uma mensagem do Compose e nada explicando o que ela é.
    const exemplo = ler(path.join(PROJETO, ".env.example"));
    const prod = ler(path.join(PROJETO, "docker-compose.prod.yml"));

    for (const achado of prod.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?/g)) {
      const nome = achado[1]!;
      assert.match(
        exemplo, new RegExp(`^${nome}=`, "m"),
        `${nome} é obrigatória no compose de produção e não está no .env.example`,
      );
    }
  });
});
