import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { NumeracaoSequencia } from "../ports/ProcessoRepository";
import type { NovaOrdemFornecimento, TramitacaoRepository } from "../ports/TramitacaoRepository";

export type EmitirOrdemEntrada = Omit<NovaOrdemFornecimento, "numero" | "fornecedorId"> & {
  usuarioId: string;
  lotacaoId: string;
};

// Uma ordem por contrato/fornecedor do processo. NF única por fornecedor na prefeitura.
export class EmitirOrdemFornecimento {
  constructor(
    private readonly tramitacao: TramitacaoRepository,
    private readonly sequencias: NumeracaoSequencia,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: EmitirOrdemEntrada): Promise<{ ordemId: string; numero: string }> => {
    const processo = await this.tramitacao.buscarProcesso(dados.orgaoId, dados.processoId);
    if (!processo) throw new NaoEncontrado("Processo não encontrado");
    if (processo.status === "ENCERRADO" || processo.status === "CANCELADO") {
      throw new ErroDeNegocio("Processo concluído não emite ordem de fornecimento");
    }
    const lotacaoValida = await this.tramitacao.lotacaoPertenceAoUsuario(dados.lotacaoId, dados.usuarioId);
    if (!lotacaoValida) {
      throw new ErroDeNegocio("Lotação informada não pertence ao usuário", 403);
    }

    const fornecedorId = await this.tramitacao.fornecedorDoContrato(dados.orgaoId, dados.contratoId);
    if (!fornecedorId) throw new NaoEncontrado("Contrato não encontrado neste órgão");

    const participa = await this.tramitacao.contratoParticipaDoProcesso(dados.processoId, dados.contratoId);
    if (!participa) {
      throw new ErroDeNegocio("Contrato não participa da solicitação deste processo");
    }

    if (dados.numeroNotaFiscal) {
      const duplicada = await this.tramitacao.existeNotaFiscal(dados.orgaoId, fornecedorId, dados.numeroNotaFiscal);
      if (duplicada) {
        throw new Conflito("Nota fiscal já registrada para este fornecedor", {
          numeroNotaFiscal: dados.numeroNotaFiscal,
        });
      }
    }

    return this.transacao(async (tx) => {
      const ano = new Date().getFullYear();
      const sequencial = await this.sequencias.proximoNumero(dados.orgaoId, "ORDEM_FORNECIMENTO", ano, tx);
      const numero = `${String(sequencial).padStart(4, "0")}/${ano}`;

      const ordemId = await this.tramitacao.criarOrdem({ ...dados, numero, fornecedorId }, tx);
      await this.tramitacao.registrarDespacho(
        {
          processoId: dados.processoId,
          setorId: processo.setorAtualId!,
          departamentoId: processo.departamentoAtualId ?? undefined,
          usuarioId: dados.usuarioId,
          lotacaoId: dados.lotacaoId,
          tipo: "ORDEM_FORNECIMENTO",
          texto: `Ordem de fornecimento ${numero} emitida`,
        },
        tx,
      );
      return { ordemId, numero };
    });
  };
}
