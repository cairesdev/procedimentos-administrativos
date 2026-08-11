import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { DestinoEtapa, TramitacaoRepository } from "../ports/TramitacaoRepository";
import type { FluxoRepository } from "../ports/UsuarioRepository";

export type DespacharEntrada = {
  orgaoId: string;
  processoId: string;
  usuarioId: string;
  lotacaoId: string;
  tipo: "ANALISE" | "ENCAMINHAMENTO";
  texto?: string;
  destinoSetorId?: string;
  destinoDepartamentoId?: string;
};

export class DespacharProcesso {
  constructor(
    private readonly tramitacao: TramitacaoRepository,
    private readonly fluxos: FluxoRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: DespacharEntrada): Promise<{ despachoId: string }> => {
    const processo = await this.tramitacao.buscarProcesso(dados.orgaoId, dados.processoId);
    if (!processo) throw new NaoEncontrado("Processo não encontrado");
    if (processo.status === "ENCERRADO" || processo.status === "CANCELADO") {
      throw new ErroDeNegocio("Processo encerrado ou cancelado não recebe despacho");
    }
    if (!processo.setorAtualId) {
      throw new ErroDeNegocio("Processo sem setor atual não pode ser despachado");
    }

    const lotacaoValida = await this.tramitacao.lotacaoPertenceAoUsuario(dados.lotacaoId, dados.usuarioId);
    if (!lotacaoValida) {
      throw new ErroDeNegocio("Lotação informada não pertence ao usuário", 403);
    }

    const destino =
      dados.tipo === "ENCAMINHAMENTO" ? await this.resolverDestino(dados, processo.setorAtualId, processo.tipoProcesso) : null;

    return this.transacao(async (tx) => {
      const despachoId = await this.tramitacao.registrarDespacho(
        {
          processoId: dados.processoId,
          setorId: processo.setorAtualId!,
          departamentoId: processo.departamentoAtualId ?? undefined,
          usuarioId: dados.usuarioId,
          lotacaoId: dados.lotacaoId,
          tipo: dados.tipo,
          texto: dados.texto,
        },
        tx,
      );
      if (destino) {
        await this.tramitacao.moverProcesso(dados.processoId, destino, tx);
      }
      return { despachoId };
    });
  };

  private resolverDestino = async (
    dados: DespacharEntrada,
    setorAtualId: string,
    tipoProcesso: string,
  ): Promise<DestinoEtapa> => {
    if (dados.destinoSetorId) {
      const permitido = await this.fluxos.permiteOverride(dados.orgaoId, tipoProcesso);
      if (!permitido) {
        throw new ErroDeNegocio("Escolha manual de destino não liberada no fluxo desta prefeitura");
      }
      return { setorId: dados.destinoSetorId, departamentoId: dados.destinoDepartamentoId ?? null };
    }
    const proxima = await this.tramitacao.proximaEtapaApos(dados.orgaoId, tipoProcesso, setorAtualId);
    if (!proxima) {
      throw new ErroDeNegocio("Não há próxima etapa no fluxo — conclua com parecer ou informe destino manual");
    }
    return proxima;
  };
}
