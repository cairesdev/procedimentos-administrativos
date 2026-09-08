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
