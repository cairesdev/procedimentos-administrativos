import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  ContratoDaSolicitacao,
  ItemContratoParaReserva,
  ItemDaSolicitacao,
  SolicitacaoCompleta,
  SolicitacaoDetalhe,
  SolicitacaoRepository,
  SolicitacaoResumo,
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
  // Listagem: agrega itens e valor por subconsulta para não multiplicar linhas.
  listar: `
    SELECT s.id, s.situacao,
           s.unidade_solicitante_id AS "unidadeSolicitanteId",
           u.nome AS "unidadeSolicitanteNome",
           s.processo_id AS "processoId",
           p.numero_protocolo AS "numeroProtocolo",
           p.numero_processo_adm AS "numeroProcessoAdm",
           p.status AS "statusProcesso",
           s.created_at AS "criadaEm",
           (SELECT count(*) FROM solicitacao_item si WHERE si.solicitacao_id = s.id) AS "totalItens",
           coalesce((SELECT sum(si.valor_calculado) FROM solicitacao_item si
                      WHERE si.solicitacao_id = s.id), 0) AS "valorTotal",
           ${TOTAL_DA_JANELA}
      FROM solicitacao s
      JOIN unidade u ON u.id = s.unidade_solicitante_id
      LEFT JOIN processo p ON p.id = s.processo_id
     WHERE s.orgao_id = $1
       AND ($2::text IS NULL OR s.situacao = $2)
       AND ($3::uuid IS NULL OR s.unidade_solicitante_id = $3)
     ORDER BY s.created_at DESC, s.id
     LIMIT $4 OFFSET $5`,
  cabecalhoCompleto: `
    SELECT s.id, s.situacao,
           s.unidade_solicitante_id AS "unidadeSolicitanteId",
           u.nome AS "unidadeSolicitanteNome",
           s.processo_id AS "processoId",
           p.numero_protocolo AS "numeroProtocolo",
           p.numero_processo_adm AS "numeroProcessoAdm",
           p.status AS "statusProcesso",
           s.created_at AS "criadaEm",
           (SELECT count(*) FROM solicitacao_item si WHERE si.solicitacao_id = s.id) AS "totalItens",
           coalesce((SELECT sum(si.valor_calculado) FROM solicitacao_item si
                      WHERE si.solicitacao_id = s.id), 0) AS "valorTotal"
      FROM solicitacao s
      JOIN unidade u ON u.id = s.unidade_solicitante_id
      LEFT JOIN processo p ON p.id = s.processo_id
     WHERE s.orgao_id = $1 AND s.id = $2`,
  // Item da solicitação com o que veio do contrato e o saldo de hoje.
  itensCompletos: `
    SELECT si.item_id AS "itemId", i.contrato_id AS "contratoId",
           i.produto, i.descricao, i.unidade_medida AS "unidadeMedida", i.marca,
           i.categoria,
           i.modo_medicao AS "modoMedicao", i.valor_unitario AS "valorUnitario",
           si.quantidade_solicitada AS "quantidadeSolicitada",
           si.valor_calculado AS "valorCalculado",
           i.quantidade_total AS "quantidadeTotalContratada",
           i.saldo_disponivel AS "saldoDisponivel"
      FROM solicitacao_item si
      JOIN item i ON i.id = si.item_id
     WHERE si.solicitacao_id = $1
     ORDER BY i.categoria NULLS LAST, i.produto`,
  // Contratos de onde saíram os itens desta solicitação.
  contratosDaSolicitacao: `
    SELECT DISTINCT c.id, c.numero, c.data_inicio AS "dataInicio", c.data_fim AS "dataFim",
           c.valor_total AS "valorTotal",
           c.fiscal_nome_matricula AS "fiscalNomeMatricula",
           f.id AS "fornecedorId", f.razao_social AS "fornecedorRazaoSocial",
           f.documento AS "fornecedorDocumento", f.email AS "fornecedorEmail",
           f.telefone AS "fornecedorTelefone",
           CASE WHEN c.ata_id IS NOT NULL THEN 'ATA' ELSE 'LICITACAO' END AS origem,
           coalesce(a.numero, l.numero) AS "origemNumero",
           coalesce(c.ata_id, c.licitacao_id) AS "origemId",
           -- Contrato por ata guarda o rastro até a licitação que a originou.
           la.id AS "licitacaoDaAtaId", la.numero AS "licitacaoDaAtaNumero"
      FROM solicitacao_item si
      JOIN item i ON i.id = si.item_id
      JOIN contrato c ON c.id = i.contrato_id
      JOIN fornecedor f ON f.id = c.fornecedor_id
      LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
      LEFT JOIN licitacao l ON l.id = c.licitacao_id
      LEFT JOIN licitacao la ON la.id = a.licitacao_id
     WHERE si.solicitacao_id = $1
     ORDER BY c.numero`,
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

const resumo = (linha: Record<string, unknown>): SolicitacaoResumo => ({
  ...(linha as unknown as SolicitacaoResumo),
  totalItens: Number(linha.totalItens),
  valorTotal: Number(linha.valorTotal),
});

export class PostgresSolicitacaoRepository implements SolicitacaoRepository {
  listar = async (
    orgaoId: string,
    filtros: { situacao?: string; unidadeId?: string },
    paginacao: Paginacao,
  ): Promise<Pagina<SolicitacaoResumo>> => {
    const { rows } = await pool.query(SQL.listar, [
      orgaoId, filtros.situacao ?? null, filtros.unidadeId ?? null,
      paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    const pagina = montarPagina<SolicitacaoResumo>(rows, paginacao);
    return { ...pagina, itens: pagina.itens.map(resumo) };
  };

  buscarCompleta = async (orgaoId: string, id: string): Promise<SolicitacaoCompleta | null> => {
    const cabecalho = await pool.query(SQL.cabecalhoCompleto, [orgaoId, id]);
    if (!cabecalho.rows[0]) return null;

    const [itens, contratos] = await Promise.all([
      pool.query(SQL.itensCompletos, [id]),
      pool.query(SQL.contratosDaSolicitacao, [id]),
    ]);

    return {
      ...resumo(cabecalho.rows[0]),
      itens: itens.rows.map((linha): ItemDaSolicitacao => ({
        ...(linha as unknown as ItemDaSolicitacao),
        valorUnitario: Number(linha.valorUnitario),
        quantidadeSolicitada: Number(linha.quantidadeSolicitada),
        valorCalculado: Number(linha.valorCalculado),
        quantidadeTotalContratada: Number(linha.quantidadeTotalContratada),
        saldoDisponivel: Number(linha.saldoDisponivel),
      })),
      contratos: contratos.rows.map((linha): ContratoDaSolicitacao => ({
        ...(linha as unknown as ContratoDaSolicitacao),
        valorTotal: Number(linha.valorTotal),
      })),
    };
  };

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
