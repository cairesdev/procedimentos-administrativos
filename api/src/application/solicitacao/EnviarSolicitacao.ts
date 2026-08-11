import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { ProcessoRepository } from "../ports/ProcessoRepository";
import type { SolicitacaoRepository } from "../ports/SolicitacaoRepository";
import type { FluxoRepository } from "../ports/UsuarioRepository";
import type { GeradorNumeroProcesso } from "../shared/GeradorNumeroProcesso";

export type EnviarSolicitacaoEntrada = {
  orgaoId: string;
  solicitacaoId: string;
  setorDestinoId?: string; // override manual, quando o fluxo permitir
};

// Envio: gera os dois números, cria o processo, reserva saldo — tudo na mesma transação.
export class EnviarSolicitacao {
  constructor(
    private readonly solicitacoes: SolicitacaoRepository,
    private readonly processos: ProcessoRepository,
    private readonly fluxos: FluxoRepository,
    private readonly numeracao: GeradorNumeroProcesso,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: EnviarSolicitacaoEntrada) => {
    const solicitacao = await this.solicitacoes.buscarPorId(dados.orgaoId, dados.solicitacaoId);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");
    if (solicitacao.situacao !== "RASCUNHO") {
      throw new ErroDeNegocio("Solicitação já foi enviada");
    }
    if (solicitacao.itens.length === 0) {
      throw new ErroDeNegocio("Solicitação sem itens não pode ser enviada");
    }

    const destino = await this.resolverDestino(dados);

    return this.transacao(async (tx) => {
      const itensContrato = await this.solicitacoes.bloquearItensContrato(
        dados.orgaoId,
        solicitacao.itens.map((i) => i.itemId),
        tx,
      );

      for (const pedido of solicitacao.itens) {
        const item = itensContrato.find((c) => c.id === pedido.itemId);
        if (!item) throw new NaoEncontrado(`Item ${pedido.itemId} não encontrado`);
        if (item.saldoDisponivel < pedido.quantidadeSolicitada) {
          throw new ErroDeNegocio("Saldo insuficiente no contrato", 422, {
            itemId: item.id,
            saldoDisponivel: item.saldoDisponivel,
            quantidadeSolicitada: pedido.quantidadeSolicitada,
          });
        }
      }

      for (const pedido of solicitacao.itens) {
        await this.solicitacoes.debitarSaldo(pedido.itemId, pedido.quantidadeSolicitada, tx);
      }

      const numeros = await this.numeracao.gerarPar(dados.orgaoId, tx);
      const processoId = await this.processos.criar(
        {
          orgaoId: dados.orgaoId,
          numeroProtocolo: numeros.protocolo,
          numeroProcessoAdm: numeros.processoAdm,
          tipoProcesso: "SOLICITACAO_ITENS",
          setorAtualId: destino.setorId,
          departamentoAtualId: destino.departamentoId ?? undefined,
        },
        tx,
      );
      await this.solicitacoes.marcarEnviada(dados.solicitacaoId, processoId, tx);

      return { processoId, ...numeros };
    });
  };

  private resolverDestino = async (dados: EnviarSolicitacaoEntrada) => {
    if (dados.setorDestinoId) {
      const permitido = await this.fluxos.permiteOverride(dados.orgaoId, "SOLICITACAO_ITENS");
      if (!permitido) {
        throw new ErroDeNegocio("Escolha manual de setor não está liberada no fluxo desta prefeitura");
      }
      return { setorId: dados.setorDestinoId, departamentoId: null };
    }
    const etapa = await this.fluxos.primeiraEtapa(dados.orgaoId, "SOLICITACAO_ITENS");
    if (!etapa) {
      throw new ErroDeNegocio("Fluxo de solicitação não configurado para esta prefeitura");
    }
    return etapa;
  };
}
