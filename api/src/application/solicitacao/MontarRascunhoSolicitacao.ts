import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { calcularValorSolicitado } from "../../domain/solicitacao/CalculadoraValorItem";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { ItemSolicitado, SolicitacaoRepository } from "../ports/SolicitacaoRepository";

export type MontarRascunhoEntrada = {
  orgaoId: string;
  solicitacaoId?: string;
  unidadeSolicitanteId: string;
  itens: ItemSolicitado[];
};

// Rascunho: sem números, sem reserva de saldo — ambos só no envio.
export class MontarRascunhoSolicitacao {
  constructor(
    private readonly solicitacoes: SolicitacaoRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: MontarRascunhoEntrada): Promise<{ id: string }> => {
    if (dados.itens.length === 0) {
      throw new ErroDeNegocio("Solicitação precisa de ao menos um item");
    }

    const id =
      dados.solicitacaoId ??
      (await this.solicitacoes.criarRascunho(dados.orgaoId, dados.unidadeSolicitanteId));

    if (dados.solicitacaoId) {
      const existente = await this.solicitacoes.buscarPorId(dados.orgaoId, dados.solicitacaoId);
      if (!existente) throw new NaoEncontrado("Solicitação não encontrada");
      if (existente.situacao !== "RASCUNHO") {
        throw new ErroDeNegocio("Solicitação enviada não pode ser editada — cancele e refaça");
      }
    }

    const itensComValor = await this.transacao(async (tx) => {
      const itensContrato = await this.solicitacoes.bloquearItensContrato(
        dados.orgaoId,
        dados.itens.map((i) => i.itemId),
        tx,
      );
      return dados.itens.map((pedido) => {
        const item = itensContrato.find((c) => c.id === pedido.itemId);
        if (!item) throw new NaoEncontrado(`Item ${pedido.itemId} não encontrado nos contratos do órgão`);
        return {
          itemId: pedido.itemId,
          quantidadeSolicitada: pedido.quantidadeSolicitada,
          valorCalculado: calcularValorSolicitado(item, pedido.quantidadeSolicitada),
        };
      });
    });

    await this.solicitacoes.substituirItens(id, itensComValor);
    return { id };
  };
}
