import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recusa } from "../ajudantes/dobras";
import { CATALOGO_POR_ESCOPO, ESCOPOS, tipoAPartirDoNome } from "../../src/domain/documento/Catalogo";
import { limparCorpo, tagsRemovidas } from "../../src/domain/documento/CorpoSeguro";
import { marcadoresDe, renderizar, validarContraCatalogo } from "../../src/domain/documento/Marcadores";
import {
  gerarCodigoVerificador, normalizarCodigo,
} from "../../src/domain/documento/CodigoVerificador";

describe("interpolação do modelo", () => {
  it("troca valor simples e repete o bloco de itens", () => {
    const corpo = "<p>{{contrato.numero}}</p>"
      + "<table><tbody>{{#itens}}<tr><td>{{indice}}</td><td>{{produto}}</td></tr>{{/itens}}</tbody></table>";
    const saida = renderizar(corpo, {
      contrato: { numero: "2026/026" },
      itens: [{ produto: "Açúcar" }, { produto: "Arroz" }],
    });

    assert.ok(saida.includes("<td>1</td><td>Açúcar</td>"), saida);
    assert.ok(saida.includes("<td>2</td><td>Arroz</td>"), saida);
  });

  it("escapa o valor: dado de cadastro nunca vira marcação", () => {
    const saida = renderizar("<p>{{fornecedor.nome}}</p>", {
      fornecedor: { nome: "<b>Fulano</b> & cia" },
    });
    assert.ok(saida.includes("&lt;b&gt;Fulano&lt;/b&gt; &amp; cia"), saida);
  });

  it("derruba a emissão quando falta marcador, dizendo qual", async () => {
    // Documento oficial com lacuna em branco é pior que documento que não saiu.
    await recusa(
      async () => renderizar("<p>{{contrato.inventado}}</p>", { contrato: {} }),
      /\{\{contrato\.inventado\}\}/,
    );
  });

  it("recusa bloco aberto e não fechado", async () => {
    await recusa(
      async () => renderizar("<p>{{#itens}}<td>x</td></p>", { itens: [] }),
      /não foi fechado/,
    );
  });
});

describe("catálogo por escopo", () => {
  it("não repete marcador e aceita tudo que declara", () => {
    for (const escopo of ESCOPOS) {
      const catalogo = CATALOGO_POR_ESCOPO[escopo];
      assert.equal(
        new Set(catalogo.valores).size,
        catalogo.valores.length,
        `${escopo} tem marcador repetido`,
      );

      const corpo = catalogo.valores.map((marcador) => `{{${marcador}}}`).join(" ")
        + Object.entries(catalogo.listas)
          .map(([lista, campos]) =>
            `{{#${lista}}}${campos.map((campo) => `{{${campo}}}`).join("")}{{/${lista}}}`)
          .join("");
      validarContraCatalogo(corpo, catalogo);
    }
  });

  it("reclama uma vez quando a lista não existe, não uma por coluna", async () => {
    try {
      validarContraCatalogo(
        "<table>{{#itens}}<tr><td>{{produto}}</td><td>{{valorTotal}}</td></tr>{{/itens}}</table>",
        CATALOGO_POR_ESCOPO.PROCESSO,
      );
      assert.fail("deveria recusar");
    } catch (erro) {
      const problemas = (erro as { contexto: { problemas: string[] } }).contexto.problemas;
      assert.equal(problemas.length, 1, `cascata de erros: ${problemas.join(" | ")}`);
      assert.match(problemas[0]!, /não tem lista nenhuma/);
    }
  });

  it("gera identificador legível a partir do nome", () => {
    assert.equal(tipoAPartirDoNome("Ordem de Serviço"), "ORDEM_DE_SERVICO");
    assert.equal(tipoAPartirDoNome("  Termo — nº 2  "), "TERMO_N_2");
    assert.equal(tipoAPartirDoNome("a".repeat(60)).length, 40);
  });
});

describe("corpo seguro", () => {
  it("preserva marcadores e remove o que é executável", () => {
    const modelo = "<p>{{contrato.numero}}</p>{{#itens}}<tr><td>{{produto}}</td></tr>{{/itens}}";
    const limpo = limparCorpo(modelo);
    assert.deepEqual(marcadoresDe(limpo).valores.sort(), marcadoresDe(modelo).valores.sort());

    const sujo = '<p onclick="roubar()">oi</p><script>alert(1)</script><img src="x">';
    const seguro = limparCorpo(sujo);
    assert.equal(seguro, "<p>oi</p>");
    assert.deepEqual(tagsRemovidas(sujo).sort(), ["img", "script"]);
  });

  it("é idempotente: limpar duas vezes não escapa duas vezes", () => {
    const corpo = "<p>Agora Gestão &amp; Serviços</p>";
    assert.equal(limparCorpo(limparCorpo(corpo)), limparCorpo(corpo));
  });
});

describe("código verificador", () => {
  it("sorteia sem repetir e sem caractere ambíguo", () => {
    // O código é ditado por telefone e digitado à mão: 0/O e 1/I/L saem fora.
    const amostra = Array.from({ length: 500 }, gerarCodigoVerificador);
    assert.equal(new Set(amostra).size, 500, "sorteio repetiu em 500");
    assert.ok(amostra.every((codigo) => !/[01OIL]/.test(codigo)), "alfabeto ambíguo");
  });

  it("aceita o código como o cidadão digita", () => {
    const codigo = gerarCodigoVerificador();
    assert.equal(normalizarCodigo(codigo.toLowerCase().replaceAll("-", " ")), codigo);
    assert.equal(normalizarCodigo("curto"), "");
  });
});
