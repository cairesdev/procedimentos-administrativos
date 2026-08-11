import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { SolicitacaoRepository } from "../ports/SolicitacaoRepository";
import type { TramitacaoRepository } from "../ports/TramitacaoRepository";

export type EmitirParecerEntrada = {
  orgaoId: string;
  processoId: string;
  usuarioId: string;
  lotacaoId: string;
  favoravel: boolean;
  justificativa?: string;
};

// Parecer é a etapa final (aprovação). Desfavorável em solicitação de itens
// devolve o saldo reservado aos contratos.
export class EmitirParecer {
  constructor(
    private readonly tramitacao: TramitacaoRepository,
    private readonly solicitacoes: SolicitacaoRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: EmitirParecerEntrada): Promise<{ parecerId: string }> => {
    const processo = await this.tramitacao.buscarProcesso(dados.orgaoId, dados.processoId);
    if (!processo) throw new NaoEncontrado("Processo não encontrado");
    if (processo.status === "ENCERRADO" || processo.status === "CANCELADO") {
      throw new ErroDeNegocio("Processo já concluído");
    }
    const lotacaoValida = await this.tramitacao.lotacaoPertenceAoUsuario(dados.lotacaoId, dados.usuarioId);
    if (!lotacaoValida) {
      throw new ErroDeNegocio("Lotação informada não pertence ao usuário", 403);
    }

    const solicitacao =
      processo.tipoProcesso === "SOLICITACAO_ITENS"
        ? await this.solicitacoes.buscarPorProcessoId(dados.orgaoId, dados.processoId)
        : null;

    return this.transacao(async (tx) => {
      const parecerId = await this.tramitacao.registrarParecer(
        dados.processoId, dados.favoravel, dados.justificativa, dados.usuarioId, tx,
      );
      await this.tramitacao.registrarDespacho(
        {
          processoId: dados.processoId,
          setorId: processo.setorAtualId!,
          departamentoId: processo.departamentoAtualId ?? undefined,
          usuarioId: dados.usuarioId,
          lotacaoId: dados.lotacaoId,
          tipo: "PARECER",
          texto: dados.justificativa,
        },
        tx,
      );

      if (!dados.favoravel && solicitacao) {
        await this.solicitacoes.bloquearItensContrato(
          dados.orgaoId,
          solicitacao.itens.map((i) => i.itemId),
          tx,
        );
        for (const item of solicitacao.itens) {
          await this.solicitacoes.devolverSaldo(item.itemId, item.quantidadeSolicitada, tx);
        }
      }

      await this.tramitacao.encerrarProcesso(dados.processoId, tx);
      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "PARECER_EMITIDO",
        referenciaId: dados.processoId,
        detalhes: {
          parecerId,
          favoravel: dados.favoravel,
          justificativa: dados.justificativa,
          lotacaoId: dados.lotacaoId,
          saldoDevolvido: !dados.favoravel && solicitacao ? solicitacao.itens : undefined,
        },
      }, tx);
      return { parecerId };
    });
  };
}
