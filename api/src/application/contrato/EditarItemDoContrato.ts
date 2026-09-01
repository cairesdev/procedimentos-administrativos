import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ContratoRepository, EdicaoItemContrato } from "../ports/ContratoRepository";

/**
 * Corrigir um item do contrato depois de gravado.
 *
 * Os itens entram por colagem de planilha, e erro de digitação em preço ou
 * quantidade só aparece quando alguém vai pedir o material. Antes disto, a
 * única saída era refazer o contrato inteiro — e refazer um contrato que já
 * tem solicitação não é saída nenhuma.
 *
 * **Tudo é editável; a trava é o saldo.** Baixar a quantidade abaixo do que já
 * saiu faria o contrato dever material que ele não tem. O `CHECK` da tabela
 * recusaria de qualquer jeito; conferir aqui troca o erro de constraint — que
 * chega à tela como "Erro interno" — por uma frase que diz quanto já foi
 * consumido.
 */
export class EditarItemDoContrato {
  constructor(
    private readonly contratos: ContratoRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  executar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    itemId: string;
    dados: EdicaoItemContrato;
  }): Promise<void> => {
    const item = await this.exigirItem(entrada.orgaoId, entrada.itemId);
    const { dados } = entrada;

    if (dados.quantidadeTotal <= 0) {
      throw new ErroDeNegocio("A quantidade precisa ser maior que zero");
    }
    if (dados.valorUnitario < 0 || dados.valorTotal < 0) {
      throw new ErroDeNegocio("Valor não pode ser negativo");
    }
    if (!dados.produto.trim()) {
      throw new ErroDeNegocio("O item precisa de um produto");
    }

    /**
     * O consumido é o piso da quantidade.
     *
     * Não é o saldo que manda: o saldo é o que sobrou, e ele acompanha a
     * correção. O que não se desfaz é o que já saiu em solicitação.
     */
    if (dados.quantidadeTotal < item.consumido) {
      throw new ErroDeNegocio(
        `Já saíram ${item.consumido} ${item.unidadeMedida} deste item em solicitações. `
        + `A quantidade não pode ficar abaixo disso.`,
        422,
      );
    }

    await this.contratos.atualizarItem(entrada.orgaoId, entrada.itemId, dados);

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "ITEM_CONTRATO_EDITADO",
      referenciaId: item.contratoId,
      detalhes: {
        item: item.produto,
        // O antes e o depois: é o que a controladoria vai querer ver quando o
        // valor do contrato não bater com o do documento emitido.
        de: { quantidade: item.quantidadeTotal, valorTotal: item.valorTotal },
        para: { quantidade: dados.quantidadeTotal, valorTotal: dados.valorTotal },
      },
    });
  };

  /**
   * Excluir só o que ninguém tocou.
   *
   * Item com consumo é referenciado por uma solicitação que já existe; apagá-lo
   * deixaria o pedido antigo apontando para o nada.
   */
  remover = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    itemId: string;
  }): Promise<void> => {
    const item = await this.exigirItem(entrada.orgaoId, entrada.itemId);

    if (item.consumido > 0) {
      throw new ErroDeNegocio(
        `Este item já saiu em solicitação (${item.consumido} ${item.unidadeMedida}) `
        + `e não pode ser excluído. Corrija a quantidade, se for o caso.`,
        422,
      );
    }

    await this.contratos.removerItem(entrada.orgaoId, entrada.itemId);

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "ITEM_CONTRATO_EXCLUIDO",
      referenciaId: item.contratoId,
      detalhes: { item: item.produto, quantidade: item.quantidadeTotal },
    });
  };

  private exigirItem = async (orgaoId: string, itemId: string) => {
    const item = await this.contratos.buscarItem(orgaoId, itemId);
    if (!item) throw new NaoEncontrado("Item não encontrado");
    return item;
  };
}
