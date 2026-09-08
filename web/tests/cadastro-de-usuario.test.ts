import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  assinaProntuario, camposDoConselho, comConselho, conselhoParaApi, ROLES_COM_CONSELHO,
} from "../src/features/users/conselho.ts";

/**
 * **Duas telas criam usuário**, e elas não podem divergir.
 *
 * A da prefeitura (`/administracao/usuarios`) e a do painel do produto
 * (`/admin/prefeituras/[id]`, que cria os primeiros usuários de um município
 * recém-ligado). O campo do conselho entrou só na primeira: o médico criado
 * pelo painel nascia sem CRM, e só descobria no plantão — a triagem recusando
 * o fecho, com a saída noutra tela e outra permissão.
 *
 * Nada acusava. As duas passam pela mesma rota da API, que aceitava o conselho
 * de boa vontade; o typecheck não compara schemas entre si; e o formulário que
 * esquece um campo continua compilando.
 *
 * A regra é conferida executando, e o uso dela nos dois lados é conferido no
 * texto — esta suíte roda ESM cru e não resolve os imports do `src`.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ler = (...partes: string[]) => readFileSync(path.join(AQUI, "..", ...partes), "utf8");

const base = {
  nome: "Dra. Ana Souza",
  email: "ana@prefeitura.gov.br",
  username: "ana.souza",
  senha: "senha-de-oito",
};

/** O mesmo casamento que os dois schemas fazem. */
const schema = comConselho(z.object({
  nome: z.string().min(1),
  email: z.string(),
  username: z.string(),
  senha: z.string(),
  papelBase: z.string().min(1),
  ...camposDoConselho,
}));

describe("a regra do conselho", () => {
  it("médico sem conselho é recusado", () => {
    const resultado = schema.safeParse({ ...base, papelBase: "SAUDE_MEDICO" });
    assert.equal(resultado.success, false, "passou sem CRM");
    assert.match(resultado.error!.issues.map((i) => i.message).join(" "), /conselho/i);
  });

  it("enfermeiro sem conselho é recusado", () => {
    assert.equal(
      schema.safeParse({ ...base, papelBase: "SAUDE_ENFERMEIRO" }).success,
      false,
    );
  });

  it("médico com conselho completo passa", () => {
    const resultado = schema.safeParse({
      ...base, papelBase: "SAUDE_MEDICO",
      conselhoTipo: "CRM", conselhoNumero: "12345", conselhoUf: "MA",
    });
    assert.ok(resultado.success, JSON.stringify(resultado.error?.issues));
  });

  it("conselho pela metade é recusado", () => {
    // Conselho sem UF não identifica ninguém: CRM 1234 existe em 27 estados.
    assert.equal(
      schema.safeParse({
        ...base, papelBase: "SAUDE_MEDICO", conselhoTipo: "CRM", conselhoNumero: "12345",
      }).success,
      false,
    );
  });

  it("quem não assina prontuário passa sem conselho", () => {
    for (const papel of ["ADMIN", "COMPRAS", "SAUDE_RECEPCAO", "SAUDE_TECNICO"]) {
      assert.ok(
        schema.safeParse({ ...base, papelBase: papel }).success,
        `${papel} foi recusado sem conselho, e não devia`,
      );
    }
  });

  it("é médico e enfermeiro que assinam — não a recepção nem o técnico", () => {
    assert.deepEqual([...ROLES_COM_CONSELHO].sort(), ["SAUDE_ENFERMEIRO", "SAUDE_MEDICO"]);
    // O auxiliar nem sempre está inscrito no COREN, e travar aí impediria o
    // registro do horário da medicação — o que mais precisa ser feito na hora.
    assert.ok(!assinaProntuario("SAUDE_TECNICO"));
    assert.ok(!assinaProntuario("SAUDE_RECEPCAO"));
  });

  it("campo em branco vira nulo, e não some do corpo", () => {
    // `null` é "apague" e ausência é "não mexa". Quem trocou de função e
    // deixou de assinar prontuário precisa conseguir limpar o CRM pela tela.
    assert.deepEqual(conselhoParaApi({}), {
      conselhoTipo: null, conselhoNumero: null, conselhoUf: null,
    });
    assert.equal(conselhoParaApi({ conselhoUf: "ma" }).conselhoUf, "MA");
  });
});

/**
 * A edição não desenha o nome de usuário, e o schema precisa saber disso.
 *
 * `defaultValues` mandava `username: ""` e o schema de criação reprovava com
 * "Minúsculas, números, ponto, hífen e underline (3 a 40)" — um campo que a
 * pessoa não vê na tela. **Salvar a edição de qualquer usuário estava
 * quebrado**, e não só na saúde.
 *
 * Conferido no texto porque `schemas.ts` importa `./types` sem extensão, e
 * esta suíte roda ESM cru.
 */
describe("editar usuário não cobra o nome de usuário", () => {
  const schemas = ler("src", "features", "users", "schemas.ts");
  const formulario = ler("src", "features", "users", "components", "UserForm.tsx");

  it("existe um schema próprio para a edição", () => {
    assert.match(
      schemas,
      /export const userEditSchema/,
      "sem schema de edição, o username volta a ser cobrado numa tela que não o mostra",
    );
    assert.match(
      schemas.slice(schemas.indexOf("export const userEditSchema")),
      /username:\s*z\.string\(\)\.optional\(\)/,
      "o schema de edição continua exigindo o username",
    );
  });

  it("a criação continua exigindo o username de verdade", () => {
    const criacao = schemas.slice(
      schemas.indexOf("export const userSchema"),
      schemas.indexOf("export const userEditSchema"),
    );
    assert.match(
      criacao,
      /username:\s*z\.string\(\)\.regex\(REGRA_DO_USERNAME/,
      "afrouxar o username na criação deixaria passar cadastro sem login",
    );
  });

  it("o formulário escolhe o schema pelo ato", () => {
    assert.match(
      formulario,
      /isEditing \? userEditSchema : userSchema/,
      "o formulário usa um schema só para criar e editar",
    );
  });

  it("a action da edição valida com o schema da edição", () => {
    const acoes = ler("src", "features", "users", "actions.ts");
    const edicao = acoes.slice(acoes.indexOf("export const updateUser"));
    assert.match(
      edicao,
      /userEditSchema\.parse/,
      "a tela passa mas a action reprova — o erro volta como toast do servidor",
    );
  });
});

describe("os dois cadastros usam a mesma peça", () => {
  const arquivos: [string, string][] = [
    ["schema da prefeitura", ler("src", "features", "users", "schemas.ts")],
    ["schema do painel do produto", ler("src", "features", "system-admin", "schemas.ts")],
  ];

  for (const [nome, conteudo] of arquivos) {
    it(`${nome}: espalha os campos e aplica a regra`, () => {
      assert.match(
        conteudo,
        /\.\.\.camposDoConselho/,
        `${nome} não tem os campos do conselho`,
      );
      assert.match(
        conteudo,
        /comConselho\(/,
        `${nome} tem os campos mas não cobra a regra`,
      );
    });
  }

  const formularios: [string, string][] = [
    ["formulário da prefeitura", ler("src", "features", "users", "components", "UserForm.tsx")],
    [
      "formulário do painel do produto",
      ler("src", "features", "system-admin", "components", "TenantRegistriesPanel.tsx"),
    ],
  ];

  for (const [nome, conteudo] of formularios) {
    it(`${nome}: desenha o conselho`, () => {
      /**
       * Sem `papelBase` como propriedade: o componente observa o controle por
       * conta própria. Recebido de fora, ele dependia de o pai se redesenhar a
       * cada troca do select — e o pai que esquecesse o `watch` teria um campo
       * que aparece na edição e some na criação, que foi o defeito relatado.
       */
      /**
       * Compartilhado, e não copiado: duas cópias são o começo de dois
       * comportamentos, e a que ficar para trás vai ser justamente a que
       * ninguém abre com frequência.
       */
      assert.match(
        conteudo,
        /<ConselhoFields\s+form=\{form\}\s*\/>/,
        `${nome} não desenha o conselho — o médico criado aqui nasce sem CRM`,
      );
    });
  }

  it("as actions mandam o conselho para a API", () => {
    for (const [nome, caminho] of [
      ["prefeitura", ["src", "features", "users", "actions.ts"]],
      ["painel do produto", ["src", "features", "system-admin", "actions.ts"]],
    ] as const) {
      assert.match(
        ler(...caminho),
        /conselhoParaApi\(/,
        `${nome}: o formulário coleta o conselho e a action não o envia`,
      );
    }
  });
});

/**
 * Todo papel que existe tem onde ser criado.
 *
 * `SAUDE_COORDENACAO` e `SAUDE_TERAPEUTA` nasceram na matriz de permissões, na
 * lista `ROLES`, no `CHECK` do banco e na API — e não entraram no
 * `ROLE_GROUPS`, que é a única lista que a tela de cadastro desenha. O papel
 * existia em todo lugar, menos no único lugar em que alguém precisava dele: o
 * select da criação de usuário. Ninguém conseguia criar um terapeuta, e nada
 * acusava, porque cada lista estava certa sozinha.
 */
describe("todo papel aparece na tela que cria usuário", () => {
  const arquivo = ler("src", "features", "users", "types.ts");

  /**
   * O bloco de um array, do colchete que abre ao que fecha.
   *
   * O fim é dado por quem chama porque as duas listas terminam diferente:
   * `ROLES` fecha em `] as const;` e `ROLE_GROUPS` em `\n];`. Fatiar até o
   * `];` mais próximo engolia o `ROLE_DESCRIPTIONS` inteiro — e as descrições
   * citam "CRM" e "COREN", que viravam papéis inexistentes na conferência.
   */
  const bloco = (marca: string, fim: string): string => {
    const inicio = arquivo.indexOf(marca);
    assert.notEqual(inicio, -1, `${marca} sumiu de types.ts`);
    const abre = arquivo.indexOf("[", inicio);
    const fecha = arquivo.indexOf(fim, abre);
    assert.notEqual(fecha, -1, `${marca} não fecha com "${fim}"`);
    return arquivo.slice(abre, fecha);
  };

  const nomes = (texto: string) =>
    [...texto.matchAll(/"([A-Z][A-Z_]+)"/g)].map((achado) => achado[1]!);

  const declarados = nomes(bloco("export const ROLES =", "] as const;"));
  const oferecidos = new Set(nomes(bloco("export const ROLE_GROUPS", "\n];")));

  it("acha as duas listas", () => {
    assert.ok(declarados.length > 10, `só ${declarados.length} papéis declarados`);
    assert.ok(oferecidos.size > 10, `só ${oferecidos.size} papéis oferecidos`);
  });

  for (const papel of new Set(declarados)) {
    it(`${papel} está em algum grupo do formulário`, () => {
      assert.ok(
        oferecidos.has(papel),
        `${papel} existe em ROLES e não aparece em ROLE_GROUPS — a tela de `
        + "cadastro não oferece esse papel, e ninguém consegue criar o usuário.",
      );
    });
  }
});
