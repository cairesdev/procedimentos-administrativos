import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GerenciarAlmoxarifado } from "../../src/application/almoxarifado/GerenciarAlmoxarifado";
import type { LinhaCrua } from "../../src/domain/almoxarifado/LinhaDeLocal";

const ALMOXARIFADO = "aaaaaaaa-0000-0000-0000-000000000001";

const montar = (almoxarifados: string[] = [ALMOXARIFADO]) => {
  const gravado = {
    criados: [] as { codigo: string; nome: string; almoxarifadoId: string | null }[],
    dados: [] as Record<string, unknown>[],
    eventos: [] as { tipoEvento: string; detalhes: Record<string, unknown> }[],
  };

  const caso = new GerenciarAlmoxarifado(
    {
      listarAlmoxarifados: async () => almoxarifados.map((id) => ({ id })),
      // O código já gravado é o que a próxima linha precisa enxergar.
      codigoDeLocalEmUso: async (_orgao: string, codigo: string) =>
        gravado.criados.some((local) => local.codigo === codigo),
      criarLocal: async (_orgao: string, dados: {
        codigo: string; nome: string; almoxarifadoId: string | null;
      }) => {
        gravado.criados.push(dados);
        return `local-${gravado.criados.length}`;
      },
      salvarDadosDoLocal: async (_orgao: string, id: string, dados: Record<string, unknown>) => {
        gravado.dados.push({ id, ...dados });
      },
    } as never,
    {
      registrar: async (evento: { tipoEvento: string; detalhes: Record<string, unknown> }) => {
        gravado.eventos.push(evento);
      },
    } as never,
    (async (fn: (tx: unknown) => unknown) => fn({})) as never,
  );

  return { caso, gravado };
};

const base = {
  orgaoId: "org-1",
  usuarioId: "u-1",
  almoxarifadoId: ALMOXARIFADO,
};

const escola = (codigo: string, nome: string, extra: LinhaCrua = {}): LinhaCrua =>
  ({ codigo, nome, ...extra });

describe("importar o cadastro de escolas", () => {
  it("a planilha vira escola, com os dados de entrega", async () => {
    const { caso, gravado } = montar();

    const resultado = await caso.importarLocais({
      ...base,
      linhas: [
        escola("001", "ESCOLA SÃO JOSÉ", {
          cnpj: "12.345.678/0001-90", endereco: "Rua A, 100",
          municipio: "Monção", uf: "MA", responsavel: "Maria",
        }),
        escola("002", "CRECHE CENTRAL"),
      ],
    });

    assert.equal(resultado.importados.length, 2);
    assert.equal(resultado.ignorados.length, 0);
    assert.deepEqual(gravado.criados.map((local) => local.codigo), ["001", "002"]);

    // O local nasce e recebe os dados de entrega na sequência: são duas
    // tabelas de colunas na mesma linha, e duas chamadas no repositório.
    assert.equal(gravado.dados[0]!.cnpj, "12345678000190");
    assert.equal(gravado.dados[0]!.responsavel, "Maria");
    assert.equal(gravado.dados[0]!.almoxarifadoId, ALMOXARIFADO);
  });

  it("o que já existe é pulado, com o motivo", async () => {
    const { caso, gravado } = montar();
    await caso.importarLocais({ ...base, linhas: [escola("001", "ESCOLA SÃO JOSÉ")] });

    const segunda = await caso.importarLocais({
      ...base,
      linhas: [escola("001", "ESCOLA SÃO JOSÉ"), escola("003", "ESCOLA NOVA")],
    });

    assert.equal(gravado.criados.length, 2, "a escola repetida entrou de novo");
    assert.deepEqual(segunda.importados.map((local) => local.codigo), ["003"]);
    assert.match(segunda.ignorados[0]!.motivo, /já existe um local com o código 001/);
    assert.equal(segunda.ignorados[0]!.linha, 1);
  });

  it("código repetido dentro da própria planilha entra uma vez só", async () => {
    /**
     * A exportação do sistema antigo traz a escola duas vezes com frequência —
     * uma por tipo de estoque, uma por ano. A conferência é linha a linha
     * justamente para a segunda encontrar a primeira já gravada.
     */
    const { caso, gravado } = montar();

    const resultado = await caso.importarLocais({
      ...base,
      linhas: [escola("010", "ESCOLA DUPLICADA"), escola("010", "ESCOLA DUPLICADA")],
    });

    assert.equal(gravado.criados.length, 1);
    assert.equal(resultado.ignorados.length, 1);
    assert.equal(resultado.ignorados[0]!.linha, 2);
  });

  it("linha ruim não derruba as boas, e é nomeada pelo número", async () => {
    const { caso, gravado } = montar();

    const resultado = await caso.importarLocais({
      ...base,
      linhas: [
        escola("001", "ESCOLA BOA"),
        { nome: "ESCOLA SEM CÓDIGO" },
        escola("002", "OUTRA BOA"),
      ],
    });

    assert.equal(gravado.criados.length, 2);
    assert.equal(resultado.ignorados[0]!.linha, 2);
    assert.match(resultado.ignorados[0]!.motivo, /sem código/);
  });

  it("o aviso viaja junto com a escola importada", async () => {
    // A escola entra; o CNPJ ilegível aparece no relatório para alguém
    // corrigir uma linha, em vez de refazer a planilha.
    const { caso } = montar();
    const resultado = await caso.importarLocais({
      ...base,
      linhas: [escola("001", "ESCOLA C", { cnpj: "123" })],
    });

    assert.match(resultado.importados[0]!.avisos[0]!, /CNPJ com 3 dígitos/);
  });

  it("almoxarifado de outra prefeitura não recebe escola", async () => {
    // `criarLocal` grava o órgão da sessão e não confere o destino: sem esta
    // guarda, a escola nasceria pendurada no almoxarifado do vizinho.
    const { caso, gravado } = montar([]);

    await assert.rejects(
      () => caso.importarLocais({ ...base, linhas: [escola("001", "ESCOLA")] }),
      /Almoxarifado não encontrado/,
    );
    assert.equal(gravado.criados.length, 0);
  });

  it("sem almoxarifado a escola entra solta, e isso é permitido", async () => {
    // A prefeitura pode importar o cadastro antes de decidir quem atende quem.
    const { caso, gravado } = montar();
    await caso.importarLocais({
      ...base, almoxarifadoId: null, linhas: [escola("001", "ESCOLA")],
    });

    assert.equal(gravado.criados[0]!.almoxarifadoId, null);
  });

  it("planilha vazia é recusada antes de qualquer escrita", async () => {
    const { caso, gravado } = montar();
    await assert.rejects(
      () => caso.importarLocais({ ...base, linhas: [] }),
      /Cole a planilha/,
    );
    assert.equal(gravado.eventos.length, 0);
  });

  it("a auditoria registra o lote, e não uma linha por escola", async () => {
    const { caso, gravado } = montar();
    await caso.importarLocais({
      ...base,
      linhas: [escola("001", "A"), escola("002", "B"), { nome: "SEM CÓDIGO" }],
    });

    assert.equal(gravado.eventos.length, 1);
    assert.equal(gravado.eventos[0]!.tipoEvento, "LOCAIS_IMPORTADOS");
    assert.deepEqual(gravado.eventos[0]!.detalhes, {
      linhas: 3, importados: 2, ignorados: 1, almoxarifadoId: ALMOXARIFADO,
    });
  });
});
