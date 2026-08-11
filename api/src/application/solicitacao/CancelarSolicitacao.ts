import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { ProcessoRepository } from "../ports/ProcessoRepository";
import type { SolicitacaoRepository } from "../ports/SolicitacaoRepository";

// Cancelamento é a única forma de liberar a reserva (decisão do levantamento).
// Pode partir do solicitante, de Compras ou da Controladoria.
export class CancelarSolicitacao {
  constructor(
    private readonly solicitacoes: SolicitacaoRepository,
    private readonly processos: ProcessoRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (orgaoId: string, solicitacaoId: string): Promise<void> => {
    const solicitacao = await this.solicitacoes.buscarPorId(orgaoId, solicitacaoId);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");
    if (solicitacao.situacao !== "ENVIADA" || !solicitacao.processoId) {
      throw new ErroDeNegocio("Só solicitações enviadas podem ser canceladas — rascunho pode ser apagado");
    }

    const processoId = solicitacao.processoId;

    await this.transacao(async (tx) => {
      await this.solicitacoes.bloquearItensContrato(
        orgaoId,
        solicitacao.itens.map((i) => i.itemId),
        tx,
      );
      for (const item of solicitacao.itens) {
        await this.solicitacoes.devolverSaldo(item.itemId, item.quantidadeSolicitada, tx);
      }
      await this.processos.cancelar(orgaoId, processoId, tx);
    });
  };
}
