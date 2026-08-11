import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { ProcessoRepository } from "../ports/ProcessoRepository";
import type { SolicitacaoRepository } from "../ports/SolicitacaoRepository";

export type CancelarSolicitacaoEntrada = {
  orgaoId: string;
  solicitacaoId: string;
  usuarioId?: string;
  motivo?: string;
};

// Cancelamento é a única forma de liberar a reserva (decisão do levantamento).
// Pode partir do solicitante, de Compras ou da Controladoria.
export class CancelarSolicitacao {
  constructor(
    private readonly solicitacoes: SolicitacaoRepository,
    private readonly processos: ProcessoRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: CancelarSolicitacaoEntrada): Promise<void> => {
    const solicitacao = await this.solicitacoes.buscarPorId(dados.orgaoId, dados.solicitacaoId);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");
    if (solicitacao.situacao !== "ENVIADA" || !solicitacao.processoId) {
      throw new ErroDeNegocio("Só solicitações enviadas podem ser canceladas — rascunho pode ser apagado");
    }

    const processoId = solicitacao.processoId;

    await this.transacao(async (tx) => {
      await this.solicitacoes.bloquearItensContrato(
        dados.orgaoId,
        solicitacao.itens.map((i) => i.itemId),
        tx,
      );
      for (const item of solicitacao.itens) {
        await this.solicitacoes.devolverSaldo(item.itemId, item.quantidadeSolicitada, tx);
      }
      await this.processos.cancelar(dados.orgaoId, processoId, tx);
      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "SOLICITACAO_CANCELADA",
        referenciaId: processoId,
        detalhes: {
          solicitacaoId: dados.solicitacaoId,
          motivo: dados.motivo,
          saldoDevolvido: solicitacao.itens,
        },
      }, tx);
    });
  };
}
