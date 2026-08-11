import { pool } from "./pool";
import type { Tx } from "../../application/ports/Transacao";
import type {
  ContratoDetalhe,
  ContratoRepository,
  ContratoResumo,
  EdicaoContrato,
  ItemComSaldo,
  NovoContrato,
} from "../../application/ports/ContratoRepository";

const SQL = {
  existeNumero: `SELECT 1 FROM contrato WHERE orgao_id = $1 AND numero = $2`,
  criar: `
    INSERT INTO contrato (orgao_id, processo_id, numero, fornecedor_id, licitacao_id, ata_id,
                          data_inicio, data_fim, valor_total, fiscal_nome_matricula)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
  vincularUnidade: `INSERT INTO contrato_unidade (contrato_id, unidade_id) VALUES ($1, $2)`,
  criarItem: `
    INSERT INTO item (orgao_id, contrato_id, produto, descricao, unidade_medida, marca,
                      quantidade_total, saldo_disponivel, modo_medicao, valor_unitario, valor_total)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)`,
  listar: `
    SELECT id, numero, fornecedor_id AS "fornecedorId",
           data_inicio AS "dataInicio", data_fim AS "dataFim", valor_total AS "valorTotal"
      FROM contrato
     WHERE orgao_id = $1
     ORDER BY data_inicio DESC`,
  unidadeTemAcesso: `SELECT 1 FROM contrato_unidade WHERE contrato_id = $1 AND unidade_id = $2`,
  buscar: `
    SELECT id, numero, fornecedor_id AS "fornecedorId", processo_id AS "processoId",
           data_inicio AS "dataInicio", data_fim AS "dataFim", valor_total AS "valorTotal"
      FROM contrato WHERE orgao_id = $1 AND id = $2`,
  atualizar: `
    UPDATE contrato
       SET data_inicio = COALESCE($3, data_inicio),
           data_fim = COALESCE($4, data_fim),
           fiscal_nome_matricula = CASE WHEN $5::boolean THEN $6 ELSE fiscal_nome_matricula END
     WHERE orgao_id = $1 AND id = $2`,
  limparUnidades: `DELETE FROM contrato_unidade WHERE contrato_id = $1`,
  vinculos: `
    SELECT
      (SELECT count(*) FROM solicitacao_item si
         JOIN item i ON i.id = si.item_id
        WHERE i.contrato_id = $2 AND i.orgao_id = $1) AS itens_em_solicitacoes,
      (SELECT count(*) FROM ordem_fornecimento
        WHERE contrato_id = $2 AND orgao_id = $1) AS ordens_de_fornecimento,
      (SELECT count(*) FROM item
        WHERE contrato_id = $2 AND orgao_id = $1
          AND saldo_disponivel <> quantidade_total) AS itens_com_saldo_consumido`,
  limparItens: `DELETE FROM item WHERE contrato_id = $1 AND orgao_id = $2`,
  removerCampos: `DELETE FROM contrato_campo_extra WHERE contrato_id = $1`,
  removerDotacoes: `DELETE FROM dotacao_orcamentaria WHERE contrato_id = $1`,
  remover: `DELETE FROM contrato WHERE orgao_id = $1 AND id = $2`,
  listarItens: `
    SELECT id, produto, descricao, unidade_medida AS "unidadeMedida", marca,
           quantidade_total AS "quantidadeTotal", saldo_disponivel AS "saldoDisponivel",
           modo_medicao AS "modoMedicao", valor_unitario AS "valorUnitario",
           valor_total AS "valorTotal"
      FROM item
     WHERE orgao_id = $1 AND contrato_id = $2
     ORDER BY produto`,
};

export class PostgresContratoRepository implements ContratoRepository {
  existeNumero = async (orgaoId: string, numero: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeNumero, [orgaoId, numero]);
    return (rowCount ?? 0) > 0;
  };

  criar = async (dados: NovoContrato, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criar, [
      dados.orgaoId,
      dados.processoId,
      dados.numero,
      dados.fornecedorId,
      dados.licitacaoId ?? null,
      dados.ataId ?? null,
      dados.dataInicio,
      dados.dataFim,
      dados.valorTotal,
      dados.fiscalNomeMatricula ?? null,
    ]);
    const id: string = rows[0].id;

    for (const unidadeId of dados.unidadesDestinadas) {
      await tx.query(SQL.vincularUnidade, [id, unidadeId]);
    }
    for (const item of dados.itens) {
      await tx.query(SQL.criarItem, [
        dados.orgaoId,
        id,
        item.produto,
        item.descricao ?? null,
        item.unidadeMedida,
        item.marca ?? null,
        item.quantidadeTotal,
        item.modoMedicao,
        item.valorUnitario,
        item.valorTotal,
      ]);
    }
    return id;
  };

  listar = async (orgaoId: string): Promise<ContratoResumo[]> => {
    const { rows } = await pool.query(SQL.listar, [orgaoId]);
    return rows;
  };

  unidadeTemAcesso = async (contratoId: string, unidadeId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.unidadeTemAcesso, [contratoId, unidadeId]);
    return (rowCount ?? 0) > 0;
  };

  buscar = async (orgaoId: string, id: string): Promise<ContratoDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscar, [orgaoId, id]);
    return rows[0] ?? null;
  };

  atualizar = async (orgaoId: string, id: string, dados: EdicaoContrato): Promise<void> => {
    await pool.query(SQL.atualizar, [
      orgaoId, id, dados.dataInicio ?? null, dados.dataFim ?? null,
      dados.fiscalNomeMatricula !== undefined, dados.fiscalNomeMatricula ?? null,
    ]);

    if (dados.unidadesDestinadas) {
      await pool.query(SQL.limparUnidades, [id]);
      for (const unidadeId of dados.unidadesDestinadas) {
        await pool.query(SQL.vincularUnidade, [id, unidadeId]);
      }
    }
  };

  contarVinculos = async (orgaoId: string, id: string): Promise<Record<string, number>> => {
    const { rows } = await pool.query(SQL.vinculos, [orgaoId, id]);
    return Object.fromEntries(
      Object.entries(rows[0] as Record<string, string>)
        .map(([chave, valor]) => [chave, Number(valor)])
        .filter(([, quantidade]) => (quantidade as number) > 0),
    );
  };

  remover = async (orgaoId: string, id: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.removerCampos, [id]);
    await tx.query(SQL.removerDotacoes, [id]);
    await tx.query(SQL.limparItens, [id, orgaoId]);
    await tx.query(SQL.limparUnidades, [id]);
    await tx.query(SQL.remover, [orgaoId, id]);
  };

  listarItens = async (orgaoId: string, contratoId: string): Promise<ItemComSaldo[]> => {
    const { rows } = await pool.query(SQL.listarItens, [orgaoId, contratoId]);
    return rows.map((i) => ({
      ...i,
      quantidadeTotal: Number(i.quantidadeTotal),
      saldoDisponivel: Number(i.saldoDisponivel),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    }));
  };
}
