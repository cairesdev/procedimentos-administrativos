import { SEM_TRAVA } from "./ResolverAlcance";
import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { arredondar, somar } from "../../domain/almoxarifado/Fefo";
import type { AlmoxarifadoRepository } from "../ports/AlmoxarifadoRepository";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

export type MontarSolicitacaoEntrada = {
  orgaoId: string;
  usuarioId: string;
  localSolicitanteId: string;
  tipoEstoqueId?: string;
  itens: { produtoId: string; quantidadeSolicitada: number }[];
};

/**
 * Montagem e envio do pedido da unidade.
 *
 * **Rascunho não reserva nada.** No legado cada item adicionado incrementava
 * uma chave no Redis, e um pedido montado e abandonado trancava material por 48
 * horas. Aqui o saldo só é preso no envio — o momento em que alguém de fato
 * pediu.
 */
export class SolicitarEstoque {
  constructor(
    private readonly almoxarifado: AlmoxarifadoRepository,
    private readonly usuarios: UsuarioRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  montarRascunho = async (dados: MontarSolicitacaoEntrada): Promise<{ id: string }> => {
    if (dados.itens.length === 0) {
      throw new ErroDeNegocio("Escolha ao menos um item");
    }
    await this.exigirLotacaoNoLocal(dados.orgaoId, dados.usuarioId, dados.localSolicitanteId);

    for (const item of dados.itens) {
      if (item.quantidadeSolicitada <= 0) {
        throw new ErroDeNegocio("A quantidade de cada item precisa ser maior que zero");
      }
    }

    // Produto repetido viraria duas reservas do mesmo item e dois lançamentos
    // no comprovante, com o total certo e as linhas erradas.
    const produtos = new Set(dados.itens.map((item) => item.produtoId));
    if (produtos.size !== dados.itens.length) {
      throw new ErroDeNegocio("O mesmo produto foi incluído mais de uma vez");
    }

    const id = await this.almoxarifado.criarSolicitacao(dados.orgaoId, {
      localSolicitanteId: dados.localSolicitanteId,
      autorUsuarioId: dados.usuarioId,
      tipoEstoqueId: dados.tipoEstoqueId,
    });
    await this.almoxarifado.substituirItens(dados.orgaoId, id, dados.itens);
    return { id };
  };

  atualizarItens = async (dados: {
    orgaoId: string;
    usuarioId: string;
    solicitacaoId: string;
    itens: { produtoId: string; quantidadeSolicitada: number }[];
  }): Promise<void> => {
    const solicitacao = await this.exigirRascunho(dados.orgaoId, dados.solicitacaoId);
    await this.exigirLotacaoNoLocal(
      dados.orgaoId, dados.usuarioId, solicitacao.localSolicitanteId,
    );
    await this.almoxarifado.substituirItens(dados.orgaoId, dados.solicitacaoId, dados.itens);
  };

  /**
   * Envio: confere disponibilidade e prende o saldo, na mesma transação.
   *
   * A disponibilidade é `saldo dos lotes − reservas de outras solicitações`, e
   * as duas contas olham **o mesmo almoxarifado**. No legado a reserva era por
   * unidade e o saldo somava o órgão inteiro: duas escolas pediam o mesmo
   * material, as duas passavam na validação, e a segunda descobria a falta
   * quando o almoxarife foi liberar.
   */
  enviar = async (dados: {
    orgaoId: string;
    usuarioId: string;
    solicitacaoId: string;
  }): Promise<{ reservaExpiraEm: string | null }> => {
    const solicitacao = await this.exigirRascunho(dados.orgaoId, dados.solicitacaoId);
    if (solicitacao.itens.length === 0) {
      throw new ErroDeNegocio("Solicitação sem itens não pode ser enviada");
    }
    if (!solicitacao.almoxarifadoId) {
      throw new ErroDeNegocio(
        `O local "${solicitacao.localSolicitanteNome}" não está vinculado a um almoxarifado. `
        + "Defina o almoxarifado no cadastro do local.",
      );
    }

    const config = await this.almoxarifado.buscarConfiguracao(dados.orgaoId);
    const almoxarifadoId = solicitacao.almoxarifadoId;
    const produtoIds = solicitacao.itens.map((item) => item.produtoId);

    return this.transacao(async (tx) => {
      // Trava antes de ler: sem o bloqueio, dois envios simultâneos leem o
      // mesmo saldo e os dois passam.
      const lotes = await this.almoxarifado.bloquearLotesDoProduto(
        dados.orgaoId, almoxarifadoId, produtoIds, tx,
      );
      const reservas = await this.almoxarifado.reservasPorProduto(
        dados.orgaoId, almoxarifadoId, produtoIds, tx,
      );

      const semSaldo: { produto: string; pedido: number; disponivel: number }[] = [];

      for (const item of solicitacao.itens) {
        const saldo = somar(
          lotes.filter((lote) => lote.produtoId === item.produtoId).map((lote) => lote.saldo),
        );
        const disponivel = arredondar(saldo - (reservas[item.produtoId] ?? 0));

        if (disponivel < item.quantidadeSolicitada) {
          semSaldo.push({
            produto: item.produtoNome,
            pedido: item.quantidadeSolicitada,
            disponivel: Math.max(0, disponivel),
          });
        }
      }

      // Recusa o pedido inteiro, não item a item: atender metade em silêncio
      // faria a unidade acreditar que o resto vem depois.
      if (semSaldo.length > 0) {
        throw new ErroDeNegocio(
          `Saldo insuficiente no almoxarifado para ${semSaldo.length === 1 ? "um item" : `${semSaldo.length} itens`}`,
          422,
          { itens: semSaldo },
        );
      }

      const expiraEm = config.reservaAtiva
        ? new Date(Date.now() + config.reservaPrazoHoras * 60 * 60 * 1000)
        : null;

      await this.almoxarifado.marcarEnviada(
        dados.orgaoId,
        dados.solicitacaoId,
        expiraEm,
        solicitacao.itens.map((item) => ({
          itemId: item.id,
          quantidade: item.quantidadeSolicitada,
        })),
        tx,
      );

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "SOLICITACAO_ESTOQUE_ENVIADA",
        referenciaId: dados.solicitacaoId,
        detalhes: {
          local: solicitacao.localSolicitanteNome,
          itens: solicitacao.itens.length,
          reservaExpiraEm: expiraEm?.toISOString() ?? null,
        },
      }, tx);

      return { reservaExpiraEm: expiraEm?.toISOString() ?? null };
    });
  };

  cancelar = async (dados: {
    orgaoId: string;
    usuarioId: string;
    solicitacaoId: string;
  }): Promise<void> => {
    const solicitacao = await this.almoxarifado.buscarSolicitacao(
      dados.orgaoId, dados.solicitacaoId, SEM_TRAVA,
    );
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");

    if (!["RASCUNHO", "SOLICITADA"].includes(solicitacao.status)) {
      throw new ErroDeNegocio(
        "Só é possível cancelar solicitação em rascunho ou aguardando liberação. "
        + `Esta está como ${solicitacao.status.toLowerCase()}.`,
      );
    }

    await this.transacao(async (tx) => {
      // O cancelamento devolve a reserva junto: era exatamente o que o legado
      // esquecia de fazer na liberação.
      await this.almoxarifado.cancelar(dados.orgaoId, dados.solicitacaoId, tx);
      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "SOLICITACAO_ESTOQUE_CANCELADA",
        referenciaId: dados.solicitacaoId,
        detalhes: { local: solicitacao.localSolicitanteNome, status: solicitacao.status },
      }, tx);
    });
  };

  /** Rascunho é o único estado editável: enviado já segurou saldo. */
  private exigirRascunho = async (orgaoId: string, solicitacaoId: string) => {
    const solicitacao = await this.almoxarifado.buscarSolicitacao(orgaoId, solicitacaoId, SEM_TRAVA);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");
    if (solicitacao.status !== "RASCUNHO") {
      throw new ErroDeNegocio("Solicitação já foi enviada e não pode mais ser alterada");
    }
    return solicitacao;
  };

  /**
   * Mesma regra do módulo de Processos: quem tem lotação de unidade só pede
   * pela unidade dela; quem é de setor escolhe qualquer uma. O local do
   * almoxarifado pode ou não estar ligado a uma unidade — quando não está, só
   * lotação de setor alcança.
   */
  private exigirLotacaoNoLocal = async (
    orgaoId: string,
    usuarioId: string,
    localId: string,
  ): Promise<void> => {
    const perfil = await this.usuarios.buscarPerfil(usuarioId);
    if (!perfil) throw new NaoEncontrado("Usuário não encontrado");

    const unidades = perfil.lotacoes
      .map((lotacao) => lotacao.unidadeId)
      .filter((unidadeId): unidadeId is string => Boolean(unidadeId));

    // Sem lotação de unidade, o usuário é de setor: atende várias unidades e
    // não deve ser travado — é o trabalho dele.
    if (unidades.length === 0) return;

    const local = await this.almoxarifado.buscarLocal(orgaoId, localId, SEM_TRAVA);
    if (!local) throw new NaoEncontrado("Local não encontrado");

    // Local sem unidade (depósito avulso) não pertence a ninguém: quem tem
    // lotação de unidade não fala por ele.
    if (!local.unidadeId || !unidades.includes(local.unidadeId)) {
      throw new ErroDeNegocio(
        `Você está lotado em unidade e só pode solicitar em nome dela. `
        + `O local "${local.nome}" pertence a outra.`,
        403,
      );
    }
  };
}
