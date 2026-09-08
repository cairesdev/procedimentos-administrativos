import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { ATOS, ATOS_QUE_EXIGEM_CONSELHO } from "../../src/domain/saude/AtosDaFicha";
import type { AtoDaFicha } from "../../src/domain/saude/AtosDaFicha";
import { PERMISSOES_DO_PAPEL, permissoesDe } from "../../src/domain/shared/Permissoes";

/**
 * A divisão do papel, conferida contra o código.
 *
 * A ficha impressa traz, em cada bloco, de quem é a assinatura: "TRIAGEM DE
 * ENFERMAGEM (preenchido, assinado e carimbado pelo enfermeiro)". `ATOS` é
 * aquela frase em código, e este arquivo garante que ela vale de verdade — que
 * nenhuma rota escapou da permissão do seu ato, e que a separação entre as
 * categorias não foi desfeita por descuido numa linha da matriz.
 *
 * Sem isto, uma rota que esquecesse `exigirPermissao` seria invisível na
 * revisão e catastrófica no prontuário: o técnico assinando avaliação médica
 * não quebra teste nenhum, não estoura em produção, e aparece só quando alguém
 * pede a ficha num processo.
 */

const rotas = readFileSync(
  path.join(__dirname, "..", "..", "src", "interface", "http", "routes", "saude.ts"),
  "utf8",
);

/**
 * As rotas de escrita da ficha e o ato de cada uma.
 *
 * A lista é escrita à mão de propósito: é ela que diz o que **deveria** ser, e
 * comparar o código com uma lista extraída do próprio código não prova nada.
 */
const ESCRITAS: { caminho: string; ato: AtoDaFicha }[] = [
  { caminho: "/atendimentos/:id/triagem", ato: "TRIAR" },
  { caminho: "/atendimentos/:id/avaliacao", ato: "AVALIAR" },
  { caminho: "/atendimentos/:id/exames", ato: "SOLICITAR_EXAME" },
  { caminho: "/atendimentos/:id/exames/:exameId", ato: "RESULTADO_DE_EXAME" },
  { caminho: "/atendimentos/:id/prescricoes", ato: "PRESCREVER" },
  { caminho: "/itens-prescritos/:itemId/administracoes", ato: "ADMINISTRAR" },
  { caminho: "/atendimentos/:id/procedimentos", ato: "PROCEDIMENTO" },
  { caminho: "/atendimentos/:id/desfecho", ato: "DESFECHO" },
];

describe("os atos da ficha e as rotas que os realizam", () => {
  it("toda rota de escrita declara uma permissão além do piso", () => {
    for (const { caminho, ato } of ESCRITAS) {
      const indice = rotas.indexOf(`"${caminho}"`);
      assert.notEqual(indice, -1, `rota ${caminho} sumiu do arquivo`);

      // O trecho entre o caminho e o `async` da rota é onde os middlewares
      // ficam. Vazio ali significa que só o piso `health:read` protege.
      const trecho = rotas.slice(indice, rotas.indexOf("async (req", indice));
      assert.ok(
        /pode[A-Z]\w*/.test(trecho),
        `${caminho} não tem guarda de permissão — só o piso do módulo a protege`,
      );
    }
  });

  it("cada guarda vem da matriz ATOS, e não de um literal digitado", () => {
    /**
     * Escrever `exigirPermissao("health:medical")` à mão em cada rota daria
     * dois lugares para discordarem — e o que discordasse em silêncio seria a
     * rota, porque a ficha impressa continuaria dizendo o certo.
     */
    for (const nome of Object.keys(ATOS)) {
      const declaracao = new RegExp(`exigirPermissao\\(ATOS\\.${nome}\\.permissao\\)`);
      const usadoDireto = new RegExp(`ATOS\\.${nome}`);
      assert.ok(
        !rotas.includes(`"${ATOS[nome as AtoDaFicha].permissao}"`)
        || declaracao.test(rotas) || usadoDireto.test(rotas)
        // `health:read` e `health:records` são piso e leitura: entram como
        // literal porque não são atos de escrita da ficha.
        || ["health:read", "health:records", "health:manage"]
          .includes(ATOS[nome as AtoDaFicha].permissao),
        `${nome}: a rota repete o literal da permissão em vez de ler ATOS`,
      );
    }
  });
});

describe("a separação de atos que o papel impresso encoda", () => {
  const podeFazer = (papel: string, ato: AtoDaFicha) =>
    permissoesDe(papel).has(ATOS[ato].permissao);

  it("o médico não faz triagem de enfermagem", () => {
    /**
     * Ato privativo do enfermeiro. No plantão de madrugada sem enfermeiro a
     * triagem fica em branco e os sinais vitais entram na avaliação médica —
     * que é o que acontece no papel hoje, e não é ato de enfermagem assinado
     * por quem não é enfermeiro.
     */
    assert.ok(!podeFazer("SAUDE_MEDICO", "TRIAR"));
    assert.ok(!podeFazer("SAUDE_MEDICO", "DESFECHO"));
  });

  it("o enfermeiro não avalia nem prescreve", () => {
    assert.ok(!podeFazer("SAUDE_ENFERMEIRO", "AVALIAR"));
    assert.ok(!podeFazer("SAUDE_ENFERMEIRO", "PRESCREVER"));
    assert.ok(!podeFazer("SAUDE_ENFERMEIRO", "PROCEDIMENTO"));
  });

  it("o técnico só carimba o horário da medicação", () => {
    assert.ok(podeFazer("SAUDE_TECNICO", "ADMINISTRAR"));
    for (const ato of ["TRIAR", "AVALIAR", "PRESCREVER", "DESFECHO"] as AtoDaFicha[]) {
      assert.ok(!podeFazer("SAUDE_TECNICO", ato), `o técnico não faz ${ato}`);
    }
  });

  it("a recepção identifica e não lê prontuário", () => {
    assert.ok(podeFazer("SAUDE_RECEPCAO", "ABRIR"));
    assert.ok(!permissoesDe("SAUDE_RECEPCAO").has("health:records"));
  });

  it("cada ato pertence a alguém", () => {
    // Permissão que ninguém tem é bloco da ficha que ninguém preenche.
    for (const [nome, ato] of Object.entries(ATOS)) {
      const donos = Object.keys(PERMISSOES_DO_PAPEL)
        .filter((papel) => permissoesDe(papel).has(ato.permissao));
      assert.ok(donos.length > 0, `${nome} não pertence a papel nenhum`);
    }
  });
});

describe("ato clínico não é coisa de administrador", () => {
  /**
   * A direção **lê** o serviço de saúde e **não o executa**.
   *
   * A regra já foi mais fechada: o ADMIN não tinha nem `health:read`, e o
   * efeito prático foi barrar do módulo justamente quem responde por ele. O
   * secretário de saúde é intimado pelo Ministério Público a explicar a fila e
   * não conseguia abrir a tela que a mostra.
   *
   * O que continua fora é o **ato**: abrir ficha, triar, avaliar, medicar e
   * lançar sessão. São assinados com conselho, e a ficha impressa diz o nome
   * de quem assinou — um secretário não assina triagem de enfermagem.
   *
   * A contrapartida da leitura é a auditoria: `PRONTUARIO_LIDO` registra quem
   * abriu o histórico de quem, seja enfermeiro ou secretário.
   */
  const ATOS_DE_QUEM_ATENDE = [
    "health:admit", "health:nursing", "health:medical", "health:medicate",
    // Inscrever e indicar terapia são da coordenação, e lançar sessão é de
    // quem atendeu. A direção lê a fila e não a mexe.
    "programs:manage", "programs:attend",
  ];

  for (const papel of ["ADMIN", "GESTOR"]) {
    it(`o ${papel} lê o serviço de saúde`, () => {
      const permissoes = permissoesDe(papel);
      for (const permissao of [
        "health:manage", "health:read", "health:records",
        "programs:read", "programs:setup",
      ]) {
        assert.ok(
          permissoes.has(permissao),
          `o ${papel} responde pelo serviço e precisa de ${permissao}`,
        );
      }
    });

    it(`o ${papel} não executa ato clínico`, () => {
      const permissoes = permissoesDe(papel);
      for (const permissao of ATOS_DE_QUEM_ATENDE) {
        assert.ok(
          !permissoes.has(permissao),
          `${permissao} é ato assinado com conselho — o ${papel} não o executa`,
        );
      }
    });
  }
});

describe("o conselho profissional é o carimbo", () => {
  it("todo ato que vai assinado na ficha exige conselho", () => {
    for (const ato of ATOS_QUE_EXIGEM_CONSELHO) {
      assert.match(
        ATOS[ato].assinatura,
        /carimbo|Enfermeiro|Médico/i,
        `${ato} exige conselho mas a ficha não imprime assinatura`,
      );
    }
  });

  it("a recepção e a administração de medicamento ficam de fora", () => {
    /**
     * A recepção não tem conselho. O auxiliar de enfermagem nem sempre está
     * inscrito, e travar aí impediria o registro do horário da medicação — que
     * é o registro que mais precisa ser feito na hora.
     */
    assert.ok(!ATOS_QUE_EXIGEM_CONSELHO.includes("ABRIR"));
    assert.ok(!ATOS_QUE_EXIGEM_CONSELHO.includes("ADMINISTRAR"));
  });
});
