import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { calcularValorSolicitado } from "../../domain/solicitacao/CalculadoraValorItem";
import type { ContratoRepository } from "../ports/ContratoRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { UsuarioRepository } from "../ports/UsuarioRepository";
import type { ItemSolicitado, SolicitacaoRepository } from "../ports/SolicitacaoRepository";

export type MontarRascunhoEntrada = {
  orgaoId: string;
  solicitacaoId?: string;
  unidadeSolicitanteId: string;
  usuarioId: string;
  itens: ItemSolicitado[];
};

// Rascunho: sem números, sem reserva de saldo — ambos só no envio.
export class MontarRascunhoSolicitacao {
  constructor(
    private readonly solicitacoes: SolicitacaoRepository,
    private readonly contratos: ContratoRepository,
    private readonly usuarios: UsuarioRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  executar = async (dados: MontarRascunhoEntrada): Promise<{ id: string }> => {
    if (dados.itens.length === 0) {
      throw new ErroDeNegocio("Solicitação precisa de ao menos um item");
    }

    await this.garantirQuePodePelaUnidade(dados.usuarioId, dados.unidadeSolicitanteId);

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
      // O contrato precisa estar destinado à unidade que pede. A tela já
      // filtra, mas quem chama a API direto passaria por cima e consumiria
      // saldo de contrato de outra unidade.
      const contratos = [...new Set(itensContrato.map((item) => item.contratoId))];
      const foraDaUnidade = await this.contratos.contratosForaDaUnidade(
        dados.orgaoId, contratos, dados.unidadeSolicitanteId,
      );
      if (foraDaUnidade.length > 0) {
        throw new ErroDeNegocio(
          `Contrato não destinado a esta unidade: ${foraDaUnidade.join(", ")}`,
          422,
          { contratos: foraDaUnidade },
        );
      }

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

  /**
   * Quem tem lotação de unidade só pede pela unidade dele. Quem é de setor
   * (compras, protocolo) segue pedindo por qualquer uma — é o trabalho deles
   * atender várias unidades.
   */
  private garantirQuePodePelaUnidade = async (
    usuarioId: string,
    unidadeSolicitanteId: string,
  ): Promise<void> => {
    const perfil = await this.usuarios.buscarPerfil(usuarioId);
    if (!perfil) throw new NaoEncontrado("Usuário não encontrado");

    const unidadesDaLotacao = perfil.lotacoes
      .map((lotacao) => lotacao.unidadeId)
      .filter((id): id is string => Boolean(id));

    if (unidadesDaLotacao.length === 0) return;
    if (unidadesDaLotacao.includes(unidadeSolicitanteId)) return;

    throw new ErroDeNegocio(
      "Você só pode solicitar em nome da unidade em que está lotado",
      403,
    );
  };
}
