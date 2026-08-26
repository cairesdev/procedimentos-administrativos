import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { arredondar, somar } from "../../domain/almoxarifado/Fefo";
import type {
  AlmoxarifadoRepository, ConfirmacaoDeRecebimento,
} from "../ports/AlmoxarifadoRepository";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

/** Motivos de perda aceitos — os mesmos do CHECK em `liberacao_lote`. */
export const MOTIVOS_DE_PERDA = [
  "QUEBRA_TRANSPORTE", "AVARIA", "VENCIDO", "EXTRAVIO", "OUTRO",
] as const;

export type MotivoDePerda = (typeof MOTIVOS_DE_PERDA)[number];

export type ConfirmacaoEntrada = {
  liberacaoId: string;
  quantidadeConfirmada: number;
  motivoPerda?: string;
  observacaoPerda?: string;
};

/**
 * Confirmação de recebimento pela unidade.
 *
 * A escola confere o que chegou e confirma **por lote**, não por produto: é o
 * lote que carrega a validade, e é ele que vai para a prateleira. Cada linha
 * confirmada vira estoque da unidade com a validade copiada da origem — sem
 * isso a escola saberia quanto tem e não saberia o que vence primeiro.
 *
 * **A diferença vira perda, não volta ao almoxarifado.** Se saíram 100 kg e
 * chegaram 93, os 7 kg saem do estoque da prefeitura com motivo registrado.
 * Devolvê-los ao saldo fingiria que o material está lá, e o próximo pedido
 * contaria com um arroz que ninguém tem.
 */
export class ReceberEstoque {
  constructor(
    private readonly almoxarifado: AlmoxarifadoRepository,
    private readonly usuarios: UsuarioRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  /** O que a unidade confere: cada lote entregue, com validade e origem. */
  preparar = async (dados: { orgaoId: string; solicitacaoId: string }) => {
    const solicitacao = await this.exigirLiberada(dados.orgaoId, dados.solicitacaoId);
    const liberacoes = await this.almoxarifado.listarLiberacoes(
      dados.orgaoId, dados.solicitacaoId,
    );
    return { solicitacao, liberacoes };
  };

  confirmar = async (dados: {
    orgaoId: string;
    usuarioId: string;
    solicitacaoId: string;
    confirmacoes: ConfirmacaoEntrada[];
  }): Promise<{ recebido: number; perdido: number }> => {
    const solicitacao = await this.exigirLiberada(dados.orgaoId, dados.solicitacaoId);
    await this.exigirLotacaoNoLocal(
      dados.orgaoId, dados.usuarioId, solicitacao.localSolicitanteId,
    );

    const liberacoes = await this.almoxarifado.listarLiberacoes(
      dados.orgaoId, dados.solicitacaoId,
    );
    const porId = new Map(liberacoes.map((liberacao) => [liberacao.id, liberacao]));

    // Confirmação parcial deixaria metade da entrega sem contraparte e o
    // estoque da unidade incompleto, sem nada indicando o que falta conferir.
    if (dados.confirmacoes.length !== liberacoes.length) {
      throw new ErroDeNegocio(
        `A conferência precisa cobrir as ${liberacoes.length} linhas entregues; `
        + `vieram ${dados.confirmacoes.length}.`,
        422,
      );
    }

    const preparadas: ConfirmacaoDeRecebimento[] = [];

    for (const confirmacao of dados.confirmacoes) {
      const liberacao = porId.get(confirmacao.liberacaoId);
      if (!liberacao) {
        throw new ErroDeNegocio("Há confirmação apontando para entrega de outra solicitação", 422);
      }

      const confirmada = arredondar(confirmacao.quantidadeConfirmada);
      if (confirmada < 0) {
        throw new ErroDeNegocio("A quantidade recebida não pode ser negativa");
      }
      if (confirmada > liberacao.quantidade) {
        throw new ErroDeNegocio(
          `Recebido mais do que saiu em "${liberacao.produtoNome}": `
          + `${confirmada} contra ${liberacao.quantidade} ${liberacao.unidadeMedida}. `
          + "Sobra de entrega precisa de ajuste de estoque, não de confirmação a maior.",
          422,
        );
      }

      const perdida = arredondar(liberacao.quantidade - confirmada);

      // Perda sem motivo é diferença não explicada virando número no relatório
      // do PNAE. O banco também recusa, mas o erro tem de chegar legível a quem
      // está com a caixa na mão.
      if (perdida > 0 && !confirmacao.motivoPerda) {
        throw new ErroDeNegocio(
          `Faltaram ${perdida} ${liberacao.unidadeMedida} de "${liberacao.produtoNome}". `
          + "Informe o motivo da diferença.",
          422,
          { liberacaoId: liberacao.id, motivosAceitos: MOTIVOS_DE_PERDA },
        );
      }
      if (perdida > 0 && !MOTIVOS_DE_PERDA.includes(confirmacao.motivoPerda as MotivoDePerda)) {
        throw new ErroDeNegocio(
          `Motivo de perda desconhecido: ${confirmacao.motivoPerda}`, 422,
          { motivosAceitos: MOTIVOS_DE_PERDA },
        );
      }

      preparadas.push({
        liberacaoId: liberacao.id,
        quantidadeConfirmada: confirmada,
        motivoPerda: perdida > 0 ? confirmacao.motivoPerda : undefined,
        observacaoPerda: perdida > 0 ? confirmacao.observacaoPerda : undefined,
      });
    }

    const recebido = somar(preparadas.map((c) => c.quantidadeConfirmada));
    const perdido = arredondar(somar(liberacoes.map((l) => l.quantidade)) - recebido);

    return this.transacao(async (tx) => {
      await this.almoxarifado.confirmarRecebimento(
        dados.orgaoId, dados.solicitacaoId, dados.usuarioId, preparadas, tx,
      );

      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "SOLICITACAO_ESTOQUE_RECEBIDA",
        referenciaId: dados.solicitacaoId,
        detalhes: {
          local: solicitacao.localSolicitanteNome,
          recebido,
          perdido,
          // A perda é o que interessa na auditoria: entrega que fecha é rotina.
          perdas: preparadas
            .filter((c) => c.motivoPerda)
            .map((c) => ({
              produto: porId.get(c.liberacaoId)!.produtoNome,
              quantidade: arredondar(
                porId.get(c.liberacaoId)!.quantidade - c.quantidadeConfirmada,
              ),
              motivo: c.motivoPerda,
              observacao: c.observacaoPerda,
            })),
        },
      }, tx);

      return { recebido, perdido };
    });
  };

  private exigirLiberada = async (orgaoId: string, solicitacaoId: string) => {
    const solicitacao = await this.almoxarifado.buscarSolicitacao(orgaoId, solicitacaoId);
    if (!solicitacao) throw new NaoEncontrado("Solicitação não encontrada");

    if (!["LIBERADA", "EM_TRANSITO"].includes(solicitacao.status)) {
      throw new ErroDeNegocio(
        solicitacao.status === "RECEBIDA"
          ? "Esta entrega já foi confirmada"
          : `Esta solicitação está como ${solicitacao.status.toLowerCase()} e não há o que receber`,
      );
    }
    return solicitacao;
  };

  /**
   * Quem confirma o recebimento responde pelo que entrou no estoque da escola.
   * Mesma regra do resto do sistema: lotação de unidade só fala pela dela.
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
    if (unidades.length === 0) return;

    const local = await this.almoxarifado.buscarLocal(orgaoId, localId);
    if (!local) throw new NaoEncontrado("Local não encontrado");

    if (!local.unidadeId || !unidades.includes(local.unidadeId)) {
      throw new ErroDeNegocio(
        `Você está lotado em unidade e só confirma recebimento dela. `
        + `O local "${local.nome}" pertence a outra.`,
        403,
      );
    }
  };
}
