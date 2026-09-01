import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditarItemDoContrato } from "../../src/application/contrato/EditarItemDoContrato";
import type { ItemDoContrato } from "../../src/application/ports/ContratoRepository";

const recusa = async (acao: () => Promise<unknown>, mensagem: RegExp) => {
  await assert.rejects(acao, (erro: Error) => {
    assert.match(erro.message, mensagem);
    return true;
  });
};

const ITEM: ItemDoContrato = {
  id: "item-1",
  contratoId: "contrato-1",
  produto: "ARROZ TIPO 1",
  descricao: null,
  unidadeMedida: "KG",
  marca: null,
  quantidadeTotal: 1000,
  saldoDisponivel: 700,
  modoMedicao: "UNIDADE",
  valorUnitario: 5,
  valorTotal: 5000,
  consumido: 300,
};

const DADOS = {
  produto: "ARROZ TIPO 1",
  unidadeMedida: "KG",
  quantidadeTotal: 1200,
  modoMedicao: "UNIDADE" as const,
  valorUnitario: 5,
  valorTotal: 6000,
};

const montar = (item: ItemDoContrato | null = ITEM) => {
  const gravado = { atualizacoes: [] as unknown[], remocoes: [] as string[], eventos: [] as string[] };

  const caso = new EditarItemDoContrato(
    {
      buscarItem: async () => item,
      atualizarItem: async (_orgao: string, id: string, dados: unknown) => {
        gravado.atualizacoes.push({ id, dados });
      },
      removerItem: async (_orgao: string, id: string) => { gravado.remocoes.push(id); },
    } as never,
    {
      registrar: async (evento: { tipoEvento: string }) => {
        gravado.eventos.push(evento.tipoEvento);
      },
    } as never,
  );

  return { caso, gravado };
};

const entrada = { orgaoId: "org-1", usuarioId: "u-1", itemId: "item-1" };

describe("corrigir item do contrato", () => {
  it("grava a correção e registra o antes e o depois", async () => {
    const { caso, gravado } = montar();
    await caso.executar({ ...entrada, dados: DADOS });

    assert.equal(gravado.atualizacoes.length, 1);
    assert.deepEqual(gravado.eventos, ["ITEM_CONTRATO_EDITADO"]);
  });

  it("aumentar a quantidade é sempre permitido", async () => {
    const { caso, gravado } = montar();
    await caso.executar({ ...entrada, dados: { ...DADOS, quantidadeTotal: 99999 } });
    assert.equal(gravado.atualizacoes.length, 1);
  });

  it("baixar até o consumido é permitido", async () => {
    // 300 já saíram; deixar o item com exatamente 300 zera o saldo, e zero é
    // válido — o `CHECK` recusa negativo, não zero.
    const { caso, gravado } = montar();
    await caso.executar({ ...entrada, dados: { ...DADOS, quantidadeTotal: 300 } });
    assert.equal(gravado.atualizacoes.length, 1);
  });

  it("baixar abaixo do consumido é recusado, dizendo quanto saiu", async () => {
    const { caso, gravado } = montar();
    await recusa(
      () => caso.executar({ ...entrada, dados: { ...DADOS, quantidadeTotal: 299 } }),
      /300 KG/,
    );
    assert.equal(gravado.atualizacoes.length, 0);
  });

  it("quantidade zero é recusada", async () => {
    const { caso } = montar();
    await recusa(
      () => caso.executar({ ...entrada, dados: { ...DADOS, quantidadeTotal: 0 } }),
      /maior que zero/,
    );
  });

  it("produto em branco é recusado", async () => {
    const { caso } = montar();
    await recusa(
      () => caso.executar({ ...entrada, dados: { ...DADOS, produto: "   " } }),
      /precisa de um produto/,
    );
  });

  it("item de outra prefeitura não é encontrado", async () => {
    // A busca já filtra por órgão; sem item, não há o que corrigir.
    const { caso } = montar(null);
    await recusa(() => caso.executar({ ...entrada, dados: DADOS }), /não encontrado/);
  });
});

describe("excluir item do contrato", () => {
  it("item que ninguém pediu sai", async () => {
    const { caso, gravado } = montar({ ...ITEM, saldoDisponivel: 1000, consumido: 0 });
    await caso.remover(entrada);

    assert.deepEqual(gravado.remocoes, ["item-1"]);
    assert.deepEqual(gravado.eventos, ["ITEM_CONTRATO_EXCLUIDO"]);
  });

  it("item com consumo não sai", async () => {
    /**
     * A solicitação antiga aponta para ele: apagá-lo deixaria o pedido
     * referenciando o nada, e o histórico é o que a prestação de contas lê.
     */
    const { caso, gravado } = montar();
    await recusa(() => caso.remover(entrada), /já saiu em solicitação/);
    assert.deepEqual(gravado.remocoes, []);
  });
});
