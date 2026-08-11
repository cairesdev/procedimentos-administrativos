import { pool } from "./pool";
import type { Tx } from "../../application/ports/Transacao";
import type {
  ItemContratoParaReserva,
  SolicitacaoDetalhe,
  SolicitacaoRepository,
} from "../../application/ports/SolicitacaoRepository";

const SQL = {
  criarRascunho: `
    INSERT INTO solicitacao (orgao_id, unidade_solicitante_id, situacao)
    VALUES ($1, $2, 'RASCUNHO')
    RETURNING id`,
  buscarPorId: `
    SELECT id, orgao_id AS "orgaoId", processo_id AS "processoId",
           unidade_solicitante_id AS "unidadeSolicitanteId", situacao
      FROM solicitacao
     WHERE orgao_id = $1 AND id = $2`,
  buscarPorProcessoId: `
    SELECT id, orgao_id AS "orgaoId", processo_id AS "processoId",
           unidade_solicitante_id AS "unidadeSolicitanteId", situacao
      FROM solicitacao
     WHERE orgao_id = $1 AND processo_id = $2`,
  itensDaSolicitacao: `
    SELECT item_id AS "itemId",
           quantidade_solicitada AS "quantidadeSolicitada",
           valor_calculado AS "valorCalculado"
      FROM solicitacao_item
     WHERE solicitacao_id = $1`,
  apagarItens: `DELETE FROM solicitacao_item WHERE solicitacao_id = $1`,
  inserirItem: `
    INSERT INTO solicitacao_item (solicitacao_id, item_id, quantidade_solicitada, valor_calculado)
    VALUES ($1, $2, $3, $4)`,
  bloquearItens: `
    SELECT i.id, i.contrato_id AS "contratoId",
           i.saldo_disponivel AS "saldoDisponivel", i.modo_medicao AS "modoMedicao",
           i.valor_unitario AS "valorUnitario", i.valor_total AS "valorTotal",
           i.quantidade_total AS "quantidadeTotal"
      FROM item i
     WHERE i.orgao_id = $1 AND i.id = ANY($2::uuid[])
     FOR UPDATE`,
  debitarSaldo: `UPDATE item SET saldo_disponivel = saldo_disponivel - $2 WHERE id = $1`,
  devolverSaldo: `UPDATE item SET saldo_disponivel = saldo_disponivel + $2 WHERE id = $1`,
  marcarEnviada: `
    UPDATE solicitacao SET situacao = 'ENVIADA', processo_id = $2 WHERE id = $1`,
};

const numerico = (linha: Record<string, unknown>): ItemContratoParaReserva => ({
  id: String(linha.id),
  contratoId: String(linha.contratoId),
  saldoDisponivel: Number(linha.saldoDisponivel),
  modoMedicao: linha.modoMedicao as ItemContratoParaReserva["modoMedicao"],
  valorUnitario: Number(linha.valorUnitario),
  valorTotal: Number(linha.valorTotal),
  quantidadeTotal: Number(linha.quantidadeTotal),
});

export class PostgresSolicitacaoRepository implements SolicitacaoRepository {
  criarRascunho = async (orgaoId: string, unidadeId: string): Promise<string> => {
    const { rows } = await pool.query(SQL.criarRascunho, [orgaoId, unidadeId]);
    return rows[0].id;
  };

  buscarPorId = async (orgaoId: string, id: string): Promise<SolicitacaoDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscarPorId, [orgaoId, id]);
    return this.montarDetalhe(rows[0]);
  };

  buscarPorProcessoId = async (orgaoId: string, processoId: string): Promise<SolicitacaoDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscarPorProcessoId, [orgaoId, processoId]);
    return this.montarDetalhe(rows[0]);
  };

  private montarDetalhe = async (solicitacao: SolicitacaoDetalhe | undefined) => {
    if (!solicitacao) return null;
    const itens = await pool.query(SQL.itensDaSolicitacao, [solicitacao.id]);
    return {
      ...solicitacao,
      itens: itens.rows.map((i) => ({
        itemId: i.itemId,
        quantidadeSolicitada: Number(i.quantidadeSolicitada),
        valorCalculado: Number(i.valorCalculado),
      })),
    };
  };

  substituirItens = async (
    solicitacaoId: string,
    itens: { itemId: string; quantidadeSolicitada: number; valorCalculado: number }[],
  ): Promise<void> => {
    await pool.query(SQL.apagarItens, [solicitacaoId]);
    for (const item of itens) {
      await pool.query(SQL.inserirItem, [
        solicitacaoId,
        item.itemId,
        item.quantidadeSolicitada,
        item.valorCalculado,
      ]);
    }
  };

  bloquearItensContrato = async (
    orgaoId: string,
    itemIds: string[],
    tx: Tx,
  ): Promise<ItemContratoParaReserva[]> => {
    const { rows } = await tx.query(SQL.bloquearItens, [orgaoId, itemIds]);
    return rows.map(numerico);
  };

  debitarSaldo = async (itemId: string, quantidade: number, tx: Tx): Promise<void> => {
    await tx.query(SQL.debitarSaldo, [itemId, quantidade]);
  };

  devolverSaldo = async (itemId: string, quantidade: number, tx: Tx): Promise<void> => {
    await tx.query(SQL.devolverSaldo, [itemId, quantidade]);
  };

  marcarEnviada = async (solicitacaoId: string, processoId: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.marcarEnviada, [solicitacaoId, processoId]);
  };
}
