import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { vigenciaAte } from "../../domain/checklist/SituacaoDoItem";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ChecklistRepository, ItemParaCumprir } from "../ports/ChecklistRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

/**
 * O ciclo de um item: cumprir, conferir, recusar, dispensar.
 *
 * **Quem cumpre marca; quem cobra confere.** Sem a segunda etapa, o fornecedor
 * fecharia o próprio item e o checklist deixaria de ser conferência — viraria
 * declaração de quem cumpre.
 */
export class CumprirItem {
  constructor(
    private readonly checklists: ChecklistRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  /**
   * Abre um ciclo: alguém entregou, e agora espera conferência.
   *
   * O anexo é registrado depois, pela rota de upload, contra o id devolvido
   * aqui. Por isso `exigeAnexo` não é conferido neste ponto — seria antes de o
   * arquivo poder existir. A cobrança acontece na conferência, que é quando
   * alguém olha o que veio.
   */
  cumprir = async (entrada: {
    orgaoId: string;
    usuarioId: string | null;
    itemId: string;
    observacao?: string | null;
  }): Promise<{ id: string }> => {
    const item = await this.exigirItem(entrada.orgaoId, entrada.itemId);

    if (item.dispensadoEm) {
      throw new ErroDeNegocio("Este item foi dispensado e não precisa mais ser cumprido");
    }
    if (item.ultimoCicloSituacao === "AGUARDANDO") {
      throw new ErroDeNegocio(
        "Já existe uma entrega aguardando conferência neste item. "
        + "Espere a resposta, ou peça para recusarem a anterior.",
        422,
      );
    }

    /**
     * Cumprir de novo o que está cumprido e vigente não é engano de digitação:
     * é a certidão nova chegando antes de a antiga vencer. O ciclo abre
     * normalmente — e o item passa a valer pelo mais recente.
     */
    const agora = new Date().toISOString();

    return this.transacao(async (tx) => {
      const id = await this.checklists.abrirCiclo({
        itemId: item.id,
        ciclo: item.ultimoCiclo + 1,
        cumpridoPor: entrada.usuarioId,
        cumpridoPorExterno: entrada.usuarioId === null,
        observacao: entrada.observacao?.trim() || null,
        // Calculada aqui, e não no banco: a regra de quanto tempo vale é do
        // domínio, e o teste dela não precisa de Postgres.
        vigenciaAte: vigenciaAte(agora, item.periodicidadeDias),
      }, tx);

      await this.auditoria.registrar({
        orgaoId: entrada.orgaoId,
        usuarioId: entrada.usuarioId ?? undefined,
        tipoEvento: "CHECKLIST_ITEM_CUMPRIDO",
        referenciaId: item.checklistId,
        detalhes: { item: item.titulo, ciclo: item.ultimoCiclo + 1 },
      }, tx);

      return { id };
    });
  };

  /**
   * A resposta de quem cobra.
   *
   * Aceitar fecha o item até a vigência acabar; recusar devolve o item a
   * pendente, com o motivo visível para quem cumpriu. A recusa é resposta ao
   * que foi entregue, e não o fim da linha.
   */
  responder = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    itemId: string;
    aceitar: boolean;
    recusaMotivo?: string | null;
    /** Anexos já registrados no ciclo — a rota conta antes de chamar. */
    anexos: number;
  }): Promise<void> => {
    const item = await this.exigirItem(entrada.orgaoId, entrada.itemId);

    if (!item.ultimoCicloId || item.ultimoCicloSituacao !== "AGUARDANDO") {
      throw new NaoEncontrado("Não há entrega aguardando conferência neste item");
    }
    if (!entrada.aceitar && (entrada.recusaMotivo ?? "").trim().length < 3) {
      throw new ErroDeNegocio(
        "Recusa sem motivo deixa quem cumpriu sem saber o que corrigir",
      );
    }

    // Aqui, sim: o arquivo já teve tempo de chegar, e aceitar sem ele daria o
    // item por cumprido sem o documento que ele exigia.
    if (entrada.aceitar && item.exigeAnexo && entrada.anexos === 0) {
      throw new ErroDeNegocio(
        `"${item.titulo}" exige documento anexado, e a entrega veio sem nenhum. `
        + `Recuse pedindo o arquivo, ou tire a exigência do item.`,
        422,
      );
    }

    await this.transacao(async (tx) => {
      await this.checklists.responderCiclo({
        cicloId: item.ultimoCicloId!,
        usuarioId: entrada.usuarioId,
        aceitar: entrada.aceitar,
        recusaMotivo: entrada.aceitar ? null : entrada.recusaMotivo!.trim(),
      }, tx);

      await this.auditoria.registrar({
        orgaoId: entrada.orgaoId,
        usuarioId: entrada.usuarioId,
        tipoEvento: entrada.aceitar ? "CHECKLIST_ITEM_ACEITO" : "CHECKLIST_ITEM_RECUSADO",
        referenciaId: item.checklistId,
        detalhes: {
          item: item.titulo,
          motivo: entrada.aceitar ? null : entrada.recusaMotivo,
        },
      }, tx);
    });
  };

  /**
   * O item deixou de ser exigível.
   *
   * Diferente de cumprido — ninguém entregou nada — e diferente de pendente,
   * porque não se espera mais por ele. A justificativa é obrigatória: item que
   * some da cobrança sem explicação é item que ninguém saberá por que sumiu.
   */
  dispensar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    itemId: string;
    motivo: string;
  }): Promise<void> => {
    const item = await this.exigirItem(entrada.orgaoId, entrada.itemId);

    if (item.dispensadoEm) throw new ErroDeNegocio("Este item já está dispensado");
    if (entrada.motivo.trim().length < 3) {
      throw new ErroDeNegocio("Explique por que o item deixou de ser exigível");
    }

    await this.checklists.dispensarItem(
      entrada.orgaoId, item.id, entrada.usuarioId, entrada.motivo.trim(),
    );

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "CHECKLIST_ITEM_DISPENSADO",
      referenciaId: item.checklistId,
      detalhes: { item: item.titulo, motivo: entrada.motivo },
    });
  };

  /** Desfaz a dispensa: o item volta a ser cobrado. */
  reabrir = async (entrada: {
    orgaoId: string; usuarioId: string; itemId: string;
  }): Promise<void> => {
    const item = await this.exigirItem(entrada.orgaoId, entrada.itemId);
    if (!item.dispensadoEm) throw new ErroDeNegocio("Este item não está dispensado");

    await this.checklists.reabrirItem(entrada.orgaoId, item.id);
  };

  private exigirItem = async (orgaoId: string, itemId: string): Promise<ItemParaCumprir> => {
    const item = await this.checklists.buscarItemParaCumprir(orgaoId, itemId);
    if (!item) throw new NaoEncontrado("Item não encontrado");
    return item;
  };
}
