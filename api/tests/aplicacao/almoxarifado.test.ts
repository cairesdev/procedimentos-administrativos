import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LiberarEstoque } from "../../src/application/almoxarifado/LiberarEstoque";
import { ReceberEstoque } from "../../src/application/almoxarifado/ReceberEstoque";
import { SolicitarEstoque } from "../../src/application/almoxarifado/SolicitarEstoque";
import { auditoriaFalsa, recusa, semTransacao } from "../ajudantes/dobras";

/**
 * O almoxarifado do legado errava em três lugares, e cada um vira teste aqui:
 * a reserva que nunca era baixada, a reserva por unidade contra saldo do órgão
 * inteiro, e a liberação sem transação.
 */

type Cenario = {
  status?: string;
  lotes?: { id: string; produtoId: string; saldo: number; dataValidade?: string | null }[];
  reservas?: Record<string, number>;
  itens?: { id: string; produtoId: string; nome: string; quantidade: number }[];
  reservaAtiva?: boolean;
  lotacaoUnidade?: string | null;
  unidadeDoLocal?: string | null;
  almoxarifadoDoLocal?: string | null;
};

const montar = (cenario: Cenario = {}) => {
  const itens = cenario.itens ?? [
    { id: "item-1", produtoId: "prod-arroz", nome: "ARROZ", quantidade: 50 },
  ];

  const gravado = {
    reservas: [] as { itemId: string; quantidade: number }[],
    debitos: [] as { loteId: string; quantidade: number }[],
    liberacoes: [] as { solicitacaoItemId: string; loteId: string; quantidade: number }[],
    confirmacoes: [] as Record<string, unknown>[],
    enviada: 0,
    liberada: 0,
    recebida: 0,
    cancelada: 0,
    itensGravados: 0,
  };

  const auditoria = auditoriaFalsa();

  const almoxarifado = {
    buscarSolicitacao: async () => ({
      id: "sol-1",
      localSolicitanteId: "local-1",
      localSolicitanteNome: "Escola Central",
      almoxarifadoId: cenario.almoxarifadoDoLocal === null ? null : "almox-1",
      autorNome: "Maria",
      tipoEstoqueId: null,
      tipoEstoqueNome: null,
      status: cenario.status ?? "RASCUNHO",
      data: "2026-06-01",
      enviadaEm: null,
      reservaExpiraEm: null,
      liberadaEm: null,
      recebidaEm: null,
      motivoRecusa: null,
      itens: itens.map((item) => ({
        id: item.id,
        produtoId: item.produtoId,
        produtoNome: item.nome,
        unidadeMedida: "KG",
        quantidadeSolicitada: item.quantidade,
        quantidadeReservada: 0,
        saldoDaUnidadeNoMomento: null,
        quantidadeLiberada: null,
        quantidadeRecebida: null,
      })),
    }),
    buscarLocal: async () => ({
      id: "local-1",
      nome: "Escola Central",
      codigo: "001",
      unidadeId: cenario.unidadeDoLocal === undefined ? "un-a" : cenario.unidadeDoLocal,
      almoxarifadoId: "almox-1",
      almoxarifadoNome: "Central",
      cnpj: null,
      endereco: null,
      responsavel: null,
    }),
    buscarConfiguracao: async () => ({
      reservaAtiva: cenario.reservaAtiva ?? true,
      reservaPrazoHoras: 72,
      alertaValidadeDias: 30,
    }),
    bloquearLotesDoProduto: async () =>
      (cenario.lotes ?? [{ id: "lote-1", produtoId: "prod-arroz", saldo: 100 }]).map((lote) => ({
        ...lote,
        dataValidade: lote.dataValidade ?? null,
        remessaCodigo: "R-001",
        almoxarifadoNome: "Central",
      })),
    listarLotesComSaldo: async () =>
      (cenario.lotes ?? [{ id: "lote-1", produtoId: "prod-arroz", saldo: 100 }]).map((lote) => ({
        ...lote,
        dataValidade: lote.dataValidade ?? null,
        remessaCodigo: "R-001",
        almoxarifadoNome: "Central",
      })),
    reservasPorProduto: async () => cenario.reservas ?? {},
    criarSolicitacao: async () => "sol-nova",
    substituirItens: async (_o: string, _s: string, lista: unknown[]) => {
      gravado.itensGravados = lista.length;
    },
    marcarEnviada: async (
      _o: string, _s: string, _e: Date | null,
      reservas: { itemId: string; quantidade: number }[],
    ) => {
      gravado.enviada += 1;
      gravado.reservas.push(...reservas);
    },
    debitarLote: async (loteId: string, quantidade: number) => {
      gravado.debitos.push({ loteId, quantidade });
    },
    registrarLiberacoes: async (
      liberacoes: { solicitacaoItemId: string; loteId: string; quantidade: number }[],
    ) => {
      gravado.liberacoes.push(...liberacoes);
    },
    marcarLiberada: async () => {
      gravado.liberada += 1;
    },
    listarLiberacoes: async () => [
      {
        id: "lib-1",
        solicitacaoItemId: "item-1",
        loteId: "lote-1",
        produtoId: "prod-arroz",
        produtoNome: "ARROZ",
        unidadeMedida: "KG",
        quantidade: 50,
        quantidadeConfirmada: null,
        dataValidade: "2027-01-01",
        remessaCodigo: "R-001",
      },
    ],
    confirmarRecebimento: async (
      _o: string, _s: string, _u: string, confirmacoes: Record<string, unknown>[],
    ) => {
      gravado.recebida += 1;
      gravado.confirmacoes.push(...confirmacoes);
    },
    recusar: async () => {},
    cancelar: async () => {
      gravado.cancelada += 1;
    },
  };

  const usuarios = {
    buscarPerfil: async () => ({
      nome: "Maria",
      papelBase: "SERVIDOR",
      lotacoes: cenario.lotacaoUnidade === null
        ? [{ id: "lot-1", unidadeId: null, destino: "Compras" }]
        : [{ id: "lot-1", unidadeId: cenario.lotacaoUnidade ?? "un-a", destino: "Escola" }],
    }),
  };

  return {
    gravado,
    auditados: auditoria.registros,
    solicitar: new SolicitarEstoque(
      almoxarifado as never, usuarios as never, auditoria.porta as never, semTransacao as never,
    ),
    liberar: new LiberarEstoque(
      almoxarifado as never, auditoria.porta as never, semTransacao as never,
    ),
    receber: new ReceberEstoque(
      almoxarifado as never, usuarios as never, auditoria.porta as never, semTransacao as never,
    ),
  };
};

const pedido = { orgaoId: "org-1", usuarioId: "u-1", solicitacaoId: "sol-1" };

describe("reserva: nasce no envio e some na liberação", () => {
  it("o envio prende exatamente o que foi pedido", async () => {
    const { solicitar, gravado } = montar();
    await solicitar.enviar(pedido);

    assert.equal(gravado.enviada, 1);
    assert.deepEqual(gravado.reservas, [{ itemId: "item-1", quantidade: 50 }]);
  });

  it("rascunho não reserva nada", async () => {
    // No legado cada item adicionado ao rascunho já incrementava a chave do
    // Redis, e pedido montado e abandonado trancava material por 48h.
    const { solicitar, gravado } = montar();
    await solicitar.montarRascunho({
      orgaoId: "org-1",
      usuarioId: "u-1",
      localSolicitanteId: "local-1",
      itens: [{ produtoId: "prod-arroz", quantidadeSolicitada: 10 }],
    });

    assert.equal(gravado.reservas.length, 0, "o rascunho reservou saldo");
    assert.equal(gravado.itensGravados, 1);
  });

  it("a reserva de outro pedido reduz o que este pode pedir", async () => {
    // O furo do legado: a reserva era por unidade e a disponibilidade somava o
    // órgão inteiro, então duas escolas não se enxergavam e as duas passavam.
    const { solicitar, gravado } = montar({
      lotes: [{ id: "lote-1", produtoId: "prod-arroz", saldo: 60 }],
      reservas: { "prod-arroz": 30 },
    });

    await recusa(() => solicitar.enviar(pedido), /Saldo insuficiente/, 422);
    assert.equal(gravado.enviada, 0, "marcou como enviada mesmo sem saldo");
    assert.equal(gravado.reservas.length, 0);
  });

  it("com a reserva desligada, não há prazo de expiração", async () => {
    const { solicitar } = montar({ reservaAtiva: false });
    const { reservaExpiraEm } = await solicitar.enviar(pedido);
    assert.equal(reservaExpiraEm, null);
  });

  it("solicitação já enviada não é enviada de novo", async () => {
    const { solicitar, gravado } = montar({ status: "SOLICITADA" });
    await recusa(() => solicitar.enviar(pedido), /já foi enviada/);
    assert.equal(gravado.enviada, 0);
  });

  it("local sem almoxarifado explica o que configurar", async () => {
    const { solicitar, gravado } = montar({ almoxarifadoDoLocal: null });
    await recusa(() => solicitar.enviar(pedido), /não está vinculado a um almoxarifado/);
    assert.equal(gravado.enviada, 0);
  });
});

describe("quem pede por qual unidade", () => {
  const rascunho = {
    orgaoId: "org-1",
    usuarioId: "u-1",
    localSolicitanteId: "local-1",
    itens: [{ produtoId: "prod-arroz", quantidadeSolicitada: 10 }],
  };

  it("lotado na unidade do local, pode", async () => {
    const { solicitar, gravado } = montar({ lotacaoUnidade: "un-a", unidadeDoLocal: "un-a" });
    await solicitar.montarRascunho(rascunho);
    assert.equal(gravado.itensGravados, 1);
  });

  it("lotado em outra unidade, não pode", async () => {
    const { solicitar, gravado } = montar({ lotacaoUnidade: "un-b", unidadeDoLocal: "un-a" });
    await recusa(() => solicitar.montarRascunho(rascunho), /só pode solicitar em nome/, 403);
    assert.equal(gravado.itensGravados, 0);
  });

  it("lotado só em setor escolhe qualquer local", async () => {
    // Compras e nutrição atendem várias unidades: travá-los quebraria o
    // trabalho que já fazem.
    const { solicitar, gravado } = montar({ lotacaoUnidade: null, unidadeDoLocal: "un-z" });
    await solicitar.montarRascunho(rascunho);
    assert.equal(gravado.itensGravados, 1);
  });

  it("recusa produto repetido e lista vazia", async () => {
    const { solicitar, gravado } = montar();
    await recusa(
      () => solicitar.montarRascunho({
        ...rascunho,
        itens: [
          { produtoId: "prod-arroz", quantidadeSolicitada: 10 },
          { produtoId: "prod-arroz", quantidadeSolicitada: 5 },
        ],
      }),
      /mais de uma vez/,
    );
    await recusa(() => solicitar.montarRascunho({ ...rascunho, itens: [] }), /ao menos um item/);
    assert.equal(gravado.itensGravados, 0);
  });
});

describe("liberação", () => {
  const comLotes = {
    status: "SOLICITADA",
    lotes: [
      { id: "lote-novo", produtoId: "prod-arroz", saldo: 100, dataValidade: "2027-01-01" },
      { id: "lote-velho", produtoId: "prod-arroz", saldo: 30, dataValidade: "2026-01-01" },
    ],
  };

  it("sugere FEFO já descontando o que outro item consumiu", async () => {
    // Dois itens do mesmo produto sugeririam sacar o mesmo saldo duas vezes.
    const { liberar } = montar({
      ...comLotes,
      itens: [
        { id: "item-1", produtoId: "prod-arroz", nome: "ARROZ", quantidade: 20 },
        { id: "item-2", produtoId: "prod-arroz", nome: "ARROZ", quantidade: 20 },
      ],
    });

    const { itens } = await liberar.preparar({ orgaoId: "org-1", solicitacaoId: "sol-1" });
    const sugerido = (indice: number, loteId: string) =>
      itens[indice]!.lotes.find((lote) => lote.id === loteId)?.sugerido ?? 0;

    assert.equal(sugerido(0, "lote-velho"), 20, "o primeiro item não pegou o que vence antes");
    assert.equal(sugerido(1, "lote-velho"), 10, "o segundo item ignorou o que o primeiro levou");
    assert.equal(sugerido(1, "lote-novo"), 10);
  });

  it("marca o vencido sem tirá-lo da lista", async () => {
    // Validade só alerta: quem decide se aquele leite serve é quem está com a
    // caixa na mão.
    const { liberar } = montar({
      ...comLotes,
      lotes: [{ id: "lote-vencido", produtoId: "prod-arroz", saldo: 10, dataValidade: "2020-01-01" }],
    });

    const { itens } = await liberar.preparar({ orgaoId: "org-1", solicitacaoId: "sol-1" });
    assert.equal(itens[0]!.lotes.length, 1);
    assert.equal(itens[0]!.lotes[0]!.validade, "VENCIDO");
    assert.ok(itens[0]!.lotes[0]!.sugerido > 0, "o vencido saiu da sugestão");
  });

  it("debita e registra a liberação", async () => {
    const { liberar, gravado } = montar(comLotes);
    await liberar.liberar({
      ...pedido,
      retiradas: [
        { solicitacaoItemId: "item-1", loteId: "lote-velho", quantidade: 30 },
        { solicitacaoItemId: "item-1", loteId: "lote-novo", quantidade: 20 },
      ],
    });

    assert.equal(gravado.liberada, 1);
    assert.equal(gravado.debitos.length, 2);
    assert.equal(gravado.liberacoes.length, 2);
  });

  it("recusa liberar mais do que foi pedido", async () => {
    const { liberar, gravado } = montar(comLotes);
    await recusa(
      () => liberar.liberar({
        ...pedido,
        retiradas: [{ solicitacaoItemId: "item-1", loteId: "lote-novo", quantidade: 80 }],
      }),
      /mais do que o pedido/,
      422,
    );
    assert.equal(gravado.debitos.length, 0, "debitou antes de recusar");
    assert.equal(gravado.liberacoes.length, 0);
  });

  it("recusa lote sem o saldo escolhido", async () => {
    // Entre montar a tela e clicar em liberar, outra liberação pode ter levado.
    const { liberar, gravado } = montar(comLotes);
    await recusa(
      () => liberar.liberar({
        ...pedido,
        retiradas: [{ solicitacaoItemId: "item-1", loteId: "lote-velho", quantidade: 45 }],
      }),
      /não tem mais o saldo escolhido/,
      409,
    );
    assert.equal(gravado.debitos.length, 0);
  });

  it("recusa lote de outro produto", async () => {
    // Sem conferir, uma chamada montada à mão entregaria arroz debitando feijão.
    const { liberar, gravado } = montar({
      ...comLotes,
      lotes: [
        ...comLotes.lotes,
        { id: "lote-feijao", produtoId: "prod-feijao", saldo: 50, dataValidade: "2027-01-01" },
      ],
    });
    await recusa(
      () => liberar.liberar({
        ...pedido,
        retiradas: [{ solicitacaoItemId: "item-1", loteId: "lote-feijao", quantidade: 10 }],
      }),
      /não é do produto/,
      422,
    );
    assert.equal(gravado.debitos.length, 0);
  });

  it("recusa retirada apontando para item de outra solicitação", async () => {
    const { liberar, gravado } = montar(comLotes);
    await recusa(
      () => liberar.liberar({
        ...pedido,
        retiradas: [{ solicitacaoItemId: "item-de-outra", loteId: "lote-novo", quantidade: 5 }],
      }),
      /outra solicitação/,
      422,
    );
    assert.equal(gravado.liberacoes.length, 0);
  });

  it("liberar zero manda usar a recusa com motivo", async () => {
    const { liberar, gravado } = montar(comLotes);
    await recusa(
      () => liberar.liberar({
        ...pedido,
        retiradas: [{ solicitacaoItemId: "item-1", loteId: "lote-novo", quantidade: 0 }],
      }),
      /recusa com motivo/,
    );
    assert.equal(gravado.liberada, 0);
  });

  it("não libera o que ainda não foi enviado", async () => {
    const { liberar, gravado } = montar({ status: "RASCUNHO" });
    await recusa(
      () => liberar.liberar({
        ...pedido,
        retiradas: [{ solicitacaoItemId: "item-1", loteId: "lote-1", quantidade: 5 }],
      }),
      /ainda não foi enviada/,
    );
    assert.equal(gravado.debitos.length, 0);
  });
});

describe("recebimento e perda", () => {
  const liberada = { status: "LIBERADA" as const };

  it("entrega que fecha não gera perda", async () => {
    const { receber, gravado } = montar(liberada);
    const { recebido, perdido } = await receber.confirmar({
      ...pedido,
      confirmacoes: [{ liberacaoId: "lib-1", quantidadeConfirmada: 50 }],
    });

    assert.equal(recebido, 50);
    assert.equal(perdido, 0);
    assert.equal(gravado.recebida, 1);
    assert.equal(gravado.confirmacoes[0]!.motivoPerda, undefined);
  });

  it("a diferença vira perda com motivo", async () => {
    const { receber, gravado, auditados } = montar(liberada);
    const { recebido, perdido } = await receber.confirmar({
      ...pedido,
      confirmacoes: [{
        liberacaoId: "lib-1",
        quantidadeConfirmada: 43,
        motivoPerda: "QUEBRA_TRANSPORTE",
        observacaoPerda: "Sacos rasgados na carroceria",
      }],
    });

    assert.equal(recebido, 43);
    assert.equal(perdido, 7);
    assert.equal(gravado.confirmacoes[0]!.motivoPerda, "QUEBRA_TRANSPORTE");

    const evento = auditados.find((e) => e.tipoEvento === "SOLICITACAO_ESTOQUE_RECEBIDA");
    assert.deepEqual((evento!.detalhes as { perdas: unknown[] }).perdas, [{
      produto: "ARROZ",
      quantidade: 7,
      motivo: "QUEBRA_TRANSPORTE",
      observacao: "Sacos rasgados na carroceria",
    }]);
  });

  it("perda sem motivo é recusada, dizendo quanto faltou", async () => {
    const { receber, gravado } = montar(liberada);
    await recusa(
      () => receber.confirmar({
        ...pedido,
        confirmacoes: [{ liberacaoId: "lib-1", quantidadeConfirmada: 43 }],
      }),
      /Faltaram 7 KG de "ARROZ"/,
      422,
    );
    assert.equal(gravado.recebida, 0, "gravou o recebimento sem o motivo da falta");
    assert.equal(gravado.confirmacoes.length, 0);
  });

  it("recusa motivo fora da lista", async () => {
    const { receber, gravado } = montar(liberada);
    await recusa(
      () => receber.confirmar({
        ...pedido,
        confirmacoes: [{
          liberacaoId: "lib-1", quantidadeConfirmada: 10, motivoPerda: "SUMIU",
        }],
      }),
      /Motivo de perda desconhecido/,
      422,
    );
    assert.equal(gravado.recebida, 0);
  });

  it("recusa receber mais do que saiu", async () => {
    // Sobra de entrega é ajuste de estoque, não confirmação a maior: aceitar
    // criaria material que nunca entrou na prefeitura.
    const { receber, gravado } = montar(liberada);
    await recusa(
      () => receber.confirmar({
        ...pedido,
        confirmacoes: [{ liberacaoId: "lib-1", quantidadeConfirmada: 60 }],
      }),
      /Recebido mais do que saiu/,
      422,
    );
    assert.equal(gravado.recebida, 0);
  });

  it("exige conferir todas as linhas entregues", async () => {
    const { receber, gravado } = montar(liberada);
    await recusa(
      () => receber.confirmar({
        ...pedido,
        confirmacoes: [
          { liberacaoId: "lib-1", quantidadeConfirmada: 50 },
          { liberacaoId: "lib-2", quantidadeConfirmada: 10 },
        ],
      }),
      /precisa cobrir as 1 linhas/,
      422,
    );
    assert.equal(gravado.recebida, 0);
  });

  it("não confirma duas vezes", async () => {
    const { receber, gravado } = montar({ status: "RECEBIDA" });
    await recusa(
      () => receber.confirmar({
        ...pedido,
        confirmacoes: [{ liberacaoId: "lib-1", quantidadeConfirmada: 50 }],
      }),
      /já foi confirmada/,
    );
    assert.equal(gravado.recebida, 0);
  });

  it("quem confirma responde pela unidade dele", async () => {
    const { receber, gravado } = montar({
      status: "LIBERADA", lotacaoUnidade: "un-b", unidadeDoLocal: "un-a",
    });
    await recusa(
      () => receber.confirmar({
        ...pedido,
        confirmacoes: [{ liberacaoId: "lib-1", quantidadeConfirmada: 50 }],
      }),
      /só confirma recebimento dela/,
      403,
    );
    assert.equal(gravado.recebida, 0);
  });
});

describe("cancelamento", () => {
  it("devolve a reserva ao cancelar", async () => {
    const { solicitar, gravado } = montar({ status: "SOLICITADA" });
    await solicitar.cancelar(pedido);
    assert.equal(gravado.cancelada, 1);
  });

  it("não cancela o que já foi liberado", async () => {
    const { solicitar, gravado } = montar({ status: "LIBERADA" });
    await recusa(() => solicitar.cancelar(pedido), /rascunho ou aguardando liberação/);
    assert.equal(gravado.cancelada, 0);
  });
});
