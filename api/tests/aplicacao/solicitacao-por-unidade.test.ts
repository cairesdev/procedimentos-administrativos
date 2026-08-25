import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MontarRascunhoSolicitacao } from "../../src/application/solicitacao/MontarRascunhoSolicitacao";
import { recusa, semTransacao } from "../ajudantes/dobras";

type Opcoes = {
  lotacoes: { unidadeId: string | null }[];
  /** contratoId → unidades a que ele foi destinado */
  destinos: Record<string, string[]>;
};

const montar = (opcoes: Opcoes) => {
  const gravado = { rascunhos: 0, itens: [] as Record<string, unknown>[] };

  const solicitacoes = {
    criarRascunho: async () => {
      gravado.rascunhos += 1;
      return "sol-1";
    },
    buscarPorId: async () => null,
    // Item `i-a-*` pertence ao contrato `c-a`; `i-b-*` ao `c-b`.
    bloquearItensContrato: async (_orgao: string, ids: string[]) =>
      ids.map((id) => ({
        id,
        contratoId: id.startsWith("i-a") ? "c-a" : "c-b",
        saldoDisponivel: 100,
        modoMedicao: "UNIDADE",
        valorUnitario: 10,
        valorTotal: 1000,
        quantidadeTotal: 100,
      })),
    substituirItens: async (_id: string, itens: Record<string, unknown>[]) => {
      gravado.itens.push(...itens);
    },
  };

  const contratos = {
    contratosForaDaUnidade: async (_orgao: string, ids: string[], unidadeId: string) =>
      ids.filter((id) => !(opcoes.destinos[id] ?? []).includes(unidadeId)),
  };

  const usuarios = {
    buscarPerfil: async () => ({
      nome: "Fulano", papelBase: "SERVIDOR",
      lotacoes: opcoes.lotacoes.map((lotacao, indice) => ({
        id: `lot-${indice}`, unidadeId: lotacao.unidadeId, destino: "x",
      })),
    }),
  };

  return {
    gravado,
    caso: new MontarRascunhoSolicitacao(
      solicitacoes as never, contratos as never, usuarios as never, semTransacao as never,
    ),
  };
};

const pedido = (unidade: string, itens = ["i-a-1"]) => ({
  orgaoId: "org-1",
  usuarioId: "u-1",
  unidadeSolicitanteId: unidade,
  itens: itens.map((itemId) => ({ itemId, quantidadeSolicitada: 5 })),
});

describe("quem pode solicitar por qual unidade", () => {
  it("lotado na unidade, pedindo por ela, com contrato dela", async () => {
    const { caso, gravado } = montar({
      lotacoes: [{ unidadeId: "un-a" }],
      destinos: { "c-a": ["un-a"] },
    });
    await caso.executar(pedido("un-a"));
    assert.equal(gravado.itens.length, 1);
  });

  it("lotado em unidade não pede por outra", async () => {
    const { caso, gravado } = montar({
      lotacoes: [{ unidadeId: "un-a" }],
      destinos: { "c-a": ["un-a", "un-b"] },
    });
    await recusa(
      () => caso.executar(pedido("un-b")),
      /só pode solicitar em nome da unidade/,
      403,
    );
    assert.equal(gravado.rascunhos, 0, "criou rascunho antes de recusar");
    assert.equal(gravado.itens.length, 0);
  });

  it("lotado só em setor escolhe qualquer unidade", async () => {
    // Compras e protocolo atendem várias unidades: travá-los quebraria o
    // trabalho que já fazem.
    const { caso, gravado } = montar({
      lotacoes: [{ unidadeId: null }],
      destinos: { "c-a": ["un-z"] },
    });
    await caso.executar(pedido("un-z"));
    assert.equal(gravado.itens.length, 1);
  });

  it("duas lotações de unidade valem nas duas, não numa terceira", async () => {
    const { caso } = montar({
      lotacoes: [{ unidadeId: "un-a" }, { unidadeId: "un-b" }],
      destinos: { "c-a": ["un-a", "un-b"] },
    });
    await caso.executar(pedido("un-a"));
    await caso.executar(pedido("un-b"));
    await recusa(() => caso.executar(pedido("un-c")), /unidade em que está lotado/, 403);
  });
});

describe("contrato destinado à unidade", () => {
  it("recusa item de contrato de outra unidade, citando o contrato", async () => {
    // A tela filtra, mas quem chama a API direto passaria por cima e
    // consumiria saldo de contrato alheio.
    const { caso, gravado } = montar({
      lotacoes: [{ unidadeId: null }],
      destinos: { "c-a": ["outra-unidade"] },
    });
    await recusa(() => caso.executar(pedido("un-a")), /não destinado a esta unidade/);
    assert.equal(gravado.itens.length, 0);
  });

  it("um contrato válido e outro não: recusa tudo", async () => {
    const { caso, gravado } = montar({
      lotacoes: [{ unidadeId: null }],
      destinos: { "c-a": ["un-a"], "c-b": ["outra"] },
    });
    await recusa(() => caso.executar(pedido("un-a", ["i-a-1", "i-b-1"])), /não destinado/);
    assert.equal(gravado.itens.length, 0, "gravou parcialmente");
  });

  it("exige ao menos um item", async () => {
    const { caso } = montar({ lotacoes: [{ unidadeId: "un-a" }], destinos: {} });
    await recusa(
      () => caso.executar({ ...pedido("un-a"), itens: [] }),
      /ao menos um item/,
    );
  });
});
