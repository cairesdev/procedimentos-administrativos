import { SEM_TRAVA } from "./ResolverAlcance";
import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { arredondar, somar, sugerirRetiradas } from "../../domain/almoxarifado/Fefo";
import type {
  AlmoxarifadoRepository, FormaDeConsumo, MotivoDeAjuste,
} from "../ports/AlmoxarifadoRepository";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

export const FORMAS_DE_CONSUMO = ["ITEM_A_ITEM", "DECLARACAO_PERIODICA"] as const;

export const MOTIVOS_DE_AJUSTE = [
  "PERDA", "AVARIA", "VENCIDO", "ERRO_LANCAMENTO", "SOBRA", "CONTAGEM",
] as const;

/**
 * O que acontece com o estoque depois que ele chega.
 *
 * Consumo faz o saldo da escola diminuir — sem ele o módulo só sabe encher
 * armário. Devolução, transferência e ajuste são as três formas de o material
 * andar sem ser consumido, e cada uma existe porque a alternativa é o servidor
 * resolver por fora e o saldo ficar errado para sempre.
 */
export class MovimentarEstoque {
  constructor(
    private readonly almoxarifado: AlmoxarifadoRepository,
    private readonly usuarios: UsuarioRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  // ---- Consumo -------------------------------------------------------------

  /**
   * Baixa por consumo, em FEFO sobre o armário da escola.
   *
   * A unidade informa produto e quantidade; de quais lotes sai é conta do
   * sistema. Pedir para a cozinheira escolher a caixa seria transferir para
   * ela um trabalho que o computador faz melhor — e ela escolheria a da frente,
   * que é justamente a errada.
   */
  consumir = async (dados: {
    orgaoId: string;
    usuarioId: string;
    localId: string;
    produtoId: string;
    quantidade: number;
    forma: FormaDeConsumo;
    periodoInicio?: string;
    periodoFim?: string;
    observacao?: string;
  }): Promise<{ id: string; lotes: number }> => {
    if (dados.quantidade <= 0) {
      throw new ErroDeNegocio("A quantidade consumida precisa ser maior que zero");
    }
    await this.exigirLotacaoNoLocal(dados.orgaoId, dados.usuarioId, dados.localId);

    // O banco também recusa, mas o erro precisa chegar legível a quem preenche.
    if (dados.forma === "DECLARACAO_PERIODICA") {
      if (!dados.periodoInicio || !dados.periodoFim) {
        throw new ErroDeNegocio("A declaração periódica precisa do período que ela cobre");
      }
      if (dados.periodoFim < dados.periodoInicio) {
        throw new ErroDeNegocio("O fim do período não pode ser antes do início");
      }
    } else if (dados.periodoInicio || dados.periodoFim) {
      throw new ErroDeNegocio("Consumo item a item não tem período — ele tem a data do ato");
    }

    return this.transacao(async (tx) => {
      const lotes = await this.almoxarifado.bloquearEstoqueLocal(
        dados.orgaoId, dados.localId, dados.produtoId, tx,
      );

      const disponivel = somar(lotes.map((lote) => lote.saldo));
      if (disponivel < dados.quantidade) {
        throw new ErroDeNegocio(
          `A unidade tem ${disponivel} e o consumo informado é de ${dados.quantidade}. `
          + "Se a diferença é de contagem, use o ajuste de estoque com motivo.",
          422,
          { disponivel, informado: dados.quantidade },
        );
      }

      const { retiradas } = sugerirRetiradas(lotes, dados.quantidade);

      const id = await this.almoxarifado.registrarConsumo({
        localId: dados.localId,
        produtoId: dados.produtoId,
        quantidade: arredondar(dados.quantidade),
        forma: dados.forma,
        periodoInicio: dados.periodoInicio ?? null,
        periodoFim: dados.periodoFim ?? null,
        usuarioId: dados.usuarioId,
        observacao: dados.observacao ?? null,
        retiradas: retiradas.map((retirada) => ({
          estoqueLocalId: retirada.loteId,
          quantidade: retirada.quantidade,
        })),
      }, tx);

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "CONSUMO_ESTOQUE_REGISTRADO",
        referenciaId: id,
        detalhes: {
          local: dados.localId,
          quantidade: dados.quantidade,
          forma: dados.forma,
          lotes: retiradas.length,
        },
      }, tx);

      return { id, lotes: retiradas.length };
    });
  };

  // ---- Devolução -----------------------------------------------------------

  /**
   * A unidade devolve o que não vai usar; o material só volta ao saldo do
   * almoxarifado **depois do aceite**.
   *
   * O saldo da escola baixa no pedido, não no aceite: enquanto a devolução
   * espera resposta, aquele material não pode ser consumido nem devolvido de
   * novo. Se for recusado, volta para ela.
   */
  pedirDevolucao = async (dados: {
    orgaoId: string;
    usuarioId: string;
    estoqueLocalId: string;
    quantidade: number;
    motivo: string;
  }): Promise<{ id: string }> => {
    if (dados.quantidade <= 0) {
      throw new ErroDeNegocio("A quantidade devolvida precisa ser maior que zero");
    }
    if (dados.motivo.trim().length < 3) {
      throw new ErroDeNegocio("Explique por que o material está voltando");
    }

    return this.transacao(async (tx) => {
      const lote = await this.almoxarifado.bloquearLoteDaUnidade(
        dados.orgaoId, dados.estoqueLocalId, tx,
      );
      if (!lote) throw new NaoEncontrado("Lote não encontrado no estoque desta unidade");

      await this.exigirLotacaoNoLocal(dados.orgaoId, dados.usuarioId, lote.localId);

      if (lote.saldo < dados.quantidade) {
        throw new ErroDeNegocio(
          `A unidade tem ${lote.saldo} deste lote e a devolução é de ${dados.quantidade}`,
          422,
        );
      }
      if (!lote.almoxarifadoId) {
        throw new ErroDeNegocio(
          "O local não está vinculado a um almoxarifado; não há para onde devolver",
        );
      }

      const id = await this.almoxarifado.criarDevolucao({
        localId: lote.localId,
        almoxarifadoId: lote.almoxarifadoId,
        produtoId: lote.produtoId,
        estoqueLocalId: dados.estoqueLocalId,
        quantidade: arredondar(dados.quantidade),
        motivo: dados.motivo.trim(),
        solicitadaPorUsuarioId: dados.usuarioId,
      }, tx);

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "DEVOLUCAO_ESTOQUE_PEDIDA",
        referenciaId: id,
        detalhes: { quantidade: dados.quantidade, motivo: dados.motivo },
      }, tx);

      return { id };
    });
  };

  responderDevolucao = async (dados: {
    orgaoId: string;
    usuarioId: string;
    devolucaoId: string;
    aceitar: boolean;
    motivoRecusa?: string;
  }): Promise<void> => {
    if (!dados.aceitar && (dados.motivoRecusa ?? "").trim().length < 3) {
      throw new ErroDeNegocio(
        "Recusa sem motivo deixa a unidade sem saber o que fazer com o material",
      );
    }

    await this.transacao(async (tx) => {
      const devolucao = await this.almoxarifado.bloquearDevolucao(
        dados.orgaoId, dados.devolucaoId, tx,
      );
      if (!devolucao) throw new NaoEncontrado("Devolução não encontrada");
      if (devolucao.status !== "PENDENTE") {
        throw new ErroDeNegocio(`Esta devolução já foi ${devolucao.status.toLowerCase()}`);
      }

      await this.almoxarifado.responderDevolucao(
        dados.devolucaoId, dados.usuarioId, dados.aceitar, dados.motivoRecusa ?? null, tx,
      );

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: dados.aceitar ? "DEVOLUCAO_ESTOQUE_ACEITA" : "DEVOLUCAO_ESTOQUE_RECUSADA",
        referenciaId: dados.devolucaoId,
        detalhes: {
          quantidade: devolucao.quantidade,
          motivoRecusa: dados.aceitar ? null : dados.motivoRecusa,
        },
      }, tx);
    });
  };

  // ---- Transferência entre almoxarifados -----------------------------------

  /**
   * Move lote de um almoxarifado para outro.
   *
   * O lote pertence a uma remessa, e a remessa a um almoxarifado — então
   * transferir não muda o dono do lote: cria uma **remessa de transferência**
   * no destino, com lotes novos que preservam a validade e apontam para a
   * origem. O destino enxerga a chegada como qualquer entrada, com o mesmo
   * FEFO e o mesmo comprovante, e o rastro fica no lote.
   */
  transferir = async (dados: {
    orgaoId: string;
    usuarioId: string;
    loteId: string;
    almoxarifadoDestinoId: string;
    quantidade: number;
    motivo?: string;
  }): Promise<{ id: string; remessaDestinoId: string }> => {
    if (dados.quantidade <= 0) {
      throw new ErroDeNegocio("A quantidade transferida precisa ser maior que zero");
    }

    return this.transacao(async (tx) => {
      const lote = await this.almoxarifado.bloquearLotePorId(dados.orgaoId, dados.loteId, tx);
      if (!lote) throw new NaoEncontrado("Lote não encontrado");

      if (lote.almoxarifadoId === dados.almoxarifadoDestinoId) {
        throw new ErroDeNegocio(
          "Origem e destino são o mesmo almoxarifado — não há o que transferir",
        );
      }
      if (lote.saldo < dados.quantidade) {
        throw new ErroDeNegocio(
          `O lote tem ${lote.saldo} e a transferência é de ${dados.quantidade}`,
          422,
        );
      }

      const destino = await this.almoxarifado.buscarAlmoxarifado(
        dados.orgaoId, dados.almoxarifadoDestinoId,
      );
      if (!destino) throw new NaoEncontrado("Almoxarifado de destino não encontrado");
      if (!destino.ativo) {
        throw new ErroDeNegocio("O almoxarifado de destino está inativo");
      }

      const resultado = await this.almoxarifado.transferirLote({
        loteId: dados.loteId,
        almoxarifadoOrigemId: lote.almoxarifadoId,
        almoxarifadoDestinoId: dados.almoxarifadoDestinoId,
        quantidade: arredondar(dados.quantidade),
        usuarioId: dados.usuarioId,
        motivo: dados.motivo ?? null,
      }, tx);

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "TRANSFERENCIA_ESTOQUE_REGISTRADA",
        referenciaId: resultado.id,
        detalhes: {
          produto: lote.produtoNome,
          quantidade: dados.quantidade,
          destino: destino.nome,
          motivo: dados.motivo ?? null,
        },
      }, tx);

      return resultado;
    });
  };

  // ---- Ajuste --------------------------------------------------------------

  /**
   * Contagem física que não bate com o sistema.
   *
   * Vale nos dois lados — lote do almoxarifado ou lote no armário da escola —
   * e sempre com motivo. É a válvula que impede o resto do módulo de precisar
   * mentir: sem ajuste, quem perdeu um saco de arroz registraria um consumo
   * falso, e o relatório de consumo do PNAE viraria ficção.
   */
  ajustar = async (dados: {
    orgaoId: string;
    usuarioId: string;
    loteId?: string;
    estoqueLocalId?: string;
    saldoCorrigido: number;
    motivo: MotivoDeAjuste;
    observacao?: string;
  }): Promise<{ id: string; saldoAnterior: number }> => {
    if (Boolean(dados.loteId) === Boolean(dados.estoqueLocalId)) {
      throw new ErroDeNegocio(
        "Informe o lote do almoxarifado OU o lote da unidade — um dos dois, nunca os dois",
      );
    }
    if (dados.saldoCorrigido < 0) {
      throw new ErroDeNegocio("O saldo corrigido não pode ser negativo");
    }

    return this.transacao(async (tx) => {
      const alvo = dados.loteId
        ? await this.almoxarifado.bloquearLotePorId(dados.orgaoId, dados.loteId, tx)
        : await this.almoxarifado.bloquearLoteDaUnidade(
            dados.orgaoId, dados.estoqueLocalId!, tx,
          );

      if (!alvo) throw new NaoEncontrado("Lote não encontrado");

      const saldoAnterior = arredondar(alvo.saldo);
      const corrigido = arredondar(dados.saldoCorrigido);

      if (corrigido === saldoAnterior) {
        throw new ErroDeNegocio(
          "O saldo informado é igual ao que já está no sistema — não há ajuste a fazer",
        );
      }

      // Ajuste no lote da unidade não pode passar do que ela recebeu: acima
      // disso é material que entrou por outro caminho, e o caminho precisa ser
      // registrado, não escondido num ajuste.
      if (dados.estoqueLocalId && alvo.tetoDoLote !== null && corrigido > alvo.tetoDoLote) {
        throw new ErroDeNegocio(
          `A unidade recebeu ${alvo.tetoDoLote} deste lote; o ajuste não pode passar disso. `
          + "Material a mais precisa entrar como remessa, não como ajuste.",
          422,
        );
      }

      const id = await this.almoxarifado.registrarAjuste({
        almoxarifadoId: dados.loteId ? alvo.almoxarifadoId : null,
        loteId: dados.loteId ?? null,
        estoqueLocalId: dados.estoqueLocalId ?? null,
        saldoAnterior,
        saldoCorrigido: corrigido,
        motivo: dados.motivo,
        observacao: dados.observacao ?? null,
        usuarioId: dados.usuarioId,
      }, tx);

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "AJUSTE_ESTOQUE_REGISTRADO",
        referenciaId: id,
        detalhes: {
          produto: alvo.produtoNome,
          onde: dados.loteId ? "almoxarifado" : "unidade",
          saldoAnterior,
          saldoCorrigido: corrigido,
          diferenca: arredondar(corrigido - saldoAnterior),
          motivo: dados.motivo,
          observacao: dados.observacao ?? null,
        },
      }, tx);

      return { id, saldoAnterior };
    });
  };

  /** Mesma regra do resto do sistema: lotação de unidade só fala pela dela. */
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
    if (unidades.length === 0) return;

    const local = await this.almoxarifado.buscarLocal(orgaoId, localId, SEM_TRAVA);
    if (!local) throw new NaoEncontrado("Local não encontrado");

    if (!local.unidadeId || !unidades.includes(local.unidadeId)) {
      throw new ErroDeNegocio(
        `Você está lotado em unidade e só registra movimento dela. `
        + `O local "${local.nome}" pertence a outra.`,
        403,
      );
    }
  };
}
