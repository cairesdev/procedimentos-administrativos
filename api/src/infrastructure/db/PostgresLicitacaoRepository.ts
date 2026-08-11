import { pool } from "./pool";
import type {
  LicitacaoRepository,
  LicitacaoResumo,
  NovaLicitacao,
} from "../../application/ports/LicitacaoRepository";

const SQL = {
  existeNumero: `SELECT 1 FROM licitacao WHERE orgao_id = $1 AND numero = $2`,
  criar: `
    INSERT INTO licitacao (orgao_id, numero, resumo, objeto, modalidade, data_assinatura, valor_total)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
  vincularUnidade: `INSERT INTO licitacao_unidade (licitacao_id, unidade_id) VALUES ($1, $2)`,
  listar: `
    SELECT id, numero, resumo, objeto, modalidade,
           data_assinatura AS "dataAssinatura", valor_total AS "valorTotal"
      FROM licitacao
     WHERE orgao_id = $1
     ORDER BY data_assinatura DESC`,
  buscarPorId: `
    SELECT id, numero, resumo, objeto, modalidade,
           data_assinatura AS "dataAssinatura", valor_total AS "valorTotal"
      FROM licitacao
     WHERE orgao_id = $1 AND id = $2`,
};

export class PostgresLicitacaoRepository implements LicitacaoRepository {
  existeNumero = async (orgaoId: string, numero: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeNumero, [orgaoId, numero]);
    return (rowCount ?? 0) > 0;
  };

  criar = async (dados: NovaLicitacao): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      dados.orgaoId,
      dados.numero,
      dados.resumo ?? null,
      dados.objeto,
      dados.modalidade,
      dados.dataAssinatura,
      dados.valorTotal,
    ]);
    const id: string = rows[0].id;
    for (const unidadeId of dados.unidadesDestinadas) {
      await pool.query(SQL.vincularUnidade, [id, unidadeId]);
    }
    return id;
  };

  listar = async (orgaoId: string): Promise<LicitacaoResumo[]> => {
    const { rows } = await pool.query(SQL.listar, [orgaoId]);
    return rows;
  };

  buscarPorId = async (orgaoId: string, id: string): Promise<LicitacaoResumo | null> => {
    const { rows } = await pool.query(SQL.buscarPorId, [orgaoId, id]);
    return rows[0] ?? null;
  };
}
