import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { arredondar, somar, sugerirRetiradas } from "../../domain/almoxarifado/Fefo";
import { situacaoDaValidade } from "../../domain/almoxarifado/Validade";
import type {
  AlmoxarifadoRepository, NovaLiberacao,
} from "../ports/AlmoxarifadoRepository";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

export type RetiradaEscolhida = {
  solicitacaoItemId: string;
  loteId: string;
  quantidade: number;
};

/**
 * Liberação do almoxarife: de quais lotes sai cada item.
 *
 * FEFO é sugestão calculada no domínio e ajustável na tela. O que **não** é
 * ajustável é a aritmética: o total por item não passa do pedido, cada lote não
 * cede mais do que tem, e tudo acontece numa transação só.
 *
 * No legado esta operação eram N inserts e N updates soltos, sem `BEGIN`. Uma
 * falha no meio deixava saldo debitado sem lote de destino — estoque que sumia
 * sem ninguém ter recebido.
 */
export class LiberarEstoque {
  constructor(
    private readonly almoxarifado: AlmoxarifadoRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  /**
   * O que a tela de liberação mostra: para cada item pedido, os lotes com saldo
   * em ordem de validade e a distribuição já sugerida.
   *
   * A sugestão desconta o que os itens anteriores desta mesma solicitação já
   * consumiram do lote — senão dois itens do mesmo produto sugeririam sacar o
   * mesmo saldo duas vezes.
   */
  preparar = async (dados: { orgaoId: string; solicitacaoId: string }) => {
    const solicitacao = await this.exigirAguardandoLiberacao(dados.orgaoId, dados.solicitacaoId);
    const config = await this.almoxarifado.buscarConfiguracao(dados.orgaoId);
    const agora = new Date();

    // Leitura sem trava: segurar o lote enquanto o almoxarife decide na tela
    // prenderia o estoque pelo tempo que ele levar. A trava vem no `liberar`,
    // que confere de novo antes de debitar.
    const lotes = await this.almoxarifado.listarLotesComSaldo(
      dados.orgaoId,
      solicitacao.almoxarifadoId!,
      solicitacao.itens.map((item) => item.produtoId),
    );

    const consumidoNaSugestao: Record<string, number> = {};

    return {
      solicitacao,
      itens: solicitacao.itens.map((item) => {
        const disponiveis = lotes
          .filter((lote) => lote.produtoId === item.produtoId)
          .map((lote) => ({
            ...lote,
            saldo: arredondar(lote.saldo - (consumidoNaSugestao[lote.id] ?? 0)),
          }))
          .filter((lote) => lote.saldo > 0);

        const { retiradas, faltando } = sugerirRetiradas(
          disponiveis, item.quantidadeSolicitada,
        );
        for (const retirada of retiradas) {
          consumidoNaSugestao[retirada.loteId] =
            (consumidoNaSugestao[retirada.loteId] ?? 0) + retirada.quantidade;
        }

        return {
          ...item,
          faltando,
          lotes: disponiveis.map((lote) => ({
            id: lote.id,
            saldo: lote.saldo,
            dataValidade: lote.dataValidade,
            remessaCodigo: lote.remessaCodigo,
            almoxarifadoNome: lote.almoxarifadoNome,
            // Alerta, nunca bloqueio: lote vencido continua na lista.
            validade: situacaoDaValidade(lote.dataValidade, agora, config.alertaValidadeDias),
            sugerido: retiradas.find((r) => r.loteId === lote.id)?.quantidade ?? 0,
          })),
        };
      }),
    };
  };

  liberar = async (dados: {
    orgaoId: string;
    usuarioId: string;
    solicitacaoId: string;
    retiradas: RetiradaEscolhida[];
  }): Promise<{ itensAtendidos: number }> => {
    const solicitacao = await this.exigirAguardandoLiberacao(dados.orgaoId, dados.solicitacaoId);

    const escolhidas = dados.retiradas.filter((r) => r.quantidade > 0);
    if (escolhidas.length === 0) {
      throw new ErroDeNegocio(
        "Nenhuma quantidade foi informada. Para negar o pedido, use a recusa com motivo.",
      );
    }

    // Cada retirada tem de apontar para um item desta solicitação. Sem isto,
    // uma chamada direta à API creditaria material no pedido de outra unidade.
    const itensDaSolicitacao = new Map(solicitacao.itens.map((item) => [item.id, item]));
    for (const retirada of escolhidas) {
      if (!itensDaSolicitacao.has(retirada.solicitacaoItemId)) {
        throw new ErroDeNegocio("Há retirada apontando para item de outra solicitação", 422);
      }
    }

    const porItem = agrupar(escolhidas, (r) => r.solicitacaoItemId);
    for (const [itemId, retiradas] of porItem) {
      const item = itensDaSolicitacao.get(itemId)!;
      const total = somar(retiradas.map((r) => r.quantidade));
      if (total > item.quantidadeSolicitada) {
        throw new ErroDeNegocio(
          `Liberado mais do que o pedido em "${item.produtoNome}": `
          + `${total} contra ${item.quantidadeSolicitada} ${item.unidadeMedida}`,
          422,
        );
      }
    }

    return this.transacao(async (tx) => {
      // Trava de novo dentro da transação: entre montar a tela e clicar em
      // liberar, outra liberação pode ter levado o saldo.
      const lotes = await this.almoxarifado.bloquearLotesDoProduto(
        dados.orgaoId,
        solicitacao.almoxarifadoId!,
        solicitacao.itens.map((item) => item.produtoId),
        tx,
      );
      const saldoPorLote = new Map(lotes.map((lote) => [lote.id, lote.saldo]));

      const porLote = agrupar(escolhidas, (r) => r.loteId);
      for (const [loteId, retiradas] of porLote) {
        const saldo = saldoPorLote.get(loteId);
        if (saldo === undefined) {
          throw new ErroDeNegocio(
            "Um dos lotes não pertence a este almoxarifado ou não tem mais saldo", 422,
          );
        }
        const total = somar(retiradas.map((r) => r.quantidade));
        if (total > saldo) {
          throw new ErroDeNegocio(
            `O lote não tem mais o saldo escolhido: ${total} pedidos contra ${saldo} disponíveis. `
            + "Alguém liberou deste lote enquanto esta tela estava aberta.",
            409,
          );
        }
      }

      // O lote também tem de bater com o produto do item: sem conferir, uma
      // chamada montada à mão entregaria arroz debitando o lote de feijão.
      const loteDoProduto = new Map(lotes.map((lote) => [lote.id, lote.produtoId]));
      for (const retirada of escolhidas) {
        const item = itensDaSolicitacao.get(retirada.solicitacaoItemId)!;
        if (loteDoProduto.get(retirada.loteId) !== item.produtoId) {
          throw new ErroDeNegocio(
            `O lote escolhido não é do produto "${item.produtoNome}"`, 422,
          );
        }
      }

      for (const [loteId, retiradas] of porLote) {
        await this.almoxarifado.debitarLote(loteId, somar(retiradas.map((r) => r.quantidade)), tx);
      }

      const liberacoes: NovaLiberacao[] = escolhidas.map((retirada) => ({
        solicitacaoItemId: retirada.solicitacaoItemId,
        loteId: retirada.loteId,
        quantidade: retirada.quantidade,
      }));
      await this.almoxarifado.registrarLiberacoes(liberacoes, tx);

      // A reserva é baixada aqui, junto com o saldo — o furo do legado, onde o
      // material ficava reservado e debitado ao mesmo tempo por até 48 horas.
      await this.almoxarifado.marcarLiberada(
        dados.orgaoId,
        dados.solicitacaoId,
        dados.usuarioId,
        [...porItem].map(([itemId, retiradas]) => ({
          itemId,
          quantidade: somar(retiradas.map((r) => r.quantidade)),
        })),
        tx,
      );

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "SOLICITACAO_ESTOQUE_LIBERADA",
        referenciaId: dados.solicitacaoId,
        detalhes: {
          local: solicitacao.localSolicitanteNome,
          itensAtendidos: porItem.size,
          lotes: porLote.size,
        },
      }, tx);

      return { itensAtendidos: porItem.size };
    });
  };

  recusar = async (dados: {
    orgaoId: string;
    usuarioId: string;
    solicitacaoId: string;
    motivo: string;
  }): Promise<void> => {
    const solicitacao = await this.exigirAguardandoLiberacao(dados.orgaoId, dados.solicitacaoId);

    // A recusa devolve a reserva: o pedido negado não pode continuar segurando
    // material que outra unidade poderia pedir.
    await this.almoxarifado.recusar(
      dados.orgaoId, dados.solicitacaoId, dados.usuarioId, dados.motivo,
    );
    await this.auditoria.registrar({
      orgaoId: dados.orgaoId,
      usuarioId: dados.usuarioId,
      tipoEvento: "SOLICITACAO_ESTOQUE_RECUSADA",
      referenciaId: dados.solicitacaoId,
      detalhes: { local: solicitacao.localSolicitanteNome, motivo: dados.motivo },
    });
  };

  private exigirAguardandoLiberacao = async (orgaoId: string, solicitacaoId: string) => {
    const solicitacao = await this.almoxarifado.buscarSolicitacao(orgaoId, solicitacaoId);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");

    if (solicitacao.status !== "SOLICITADA") {
      throw new ErroDeNegocio(
        solicitacao.status === "RASCUNHO"
          ? "Esta solicitação ainda não foi enviada pela unidade"
          : `Esta solicitação já está como ${solicitacao.status.toLowerCase()}`,
      );
    }
    if (!solicitacao.almoxarifadoId) {
      throw new ErroDeNegocio("O local solicitante não está vinculado a um almoxarifado");
    }
    return solicitacao;
  };
}

const agrupar = <T>(itens: T[], chave: (item: T) => string): Map<string, T[]> => {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const nome = chave(item);
    grupos.set(nome, [...(grupos.get(nome) ?? []), item]);
  }
  return grupos;
};
