import { pool } from "./pool";
import type {
  EdicaoLicitacao,
  LicitacaoRepository,
  LicitacaoResumo,
  NovaLicitacao,
} from "../../application/ports/LicitacaoRepository";

const SQL = {
  existeNumero: `
    SELECT 1 FROM licitacao
     WHERE orgao_id = $1 AND numero = $2 AND ($3::uuid IS NULL OR id <> $3)`,
  atualizar: `
    UPDATE licitacao
       SET numero = COALESCE($3, numero),
           resumo = CASE WHEN $4::boolean THEN $5 ELSE resumo END,
           objeto = COALESCE($6, objeto),
           modalidade = COALESCE($7, modalidade),
           data_assinatura = COALESCE($8, data_assinatura),
           valor_total = COALESCE($9, valor_total)
     WHERE orgao_id = $1 AND id = $2`,
  limparUnidades: `DELETE FROM licitacao_unidade WHERE licitacao_id = $1`,
  vinculos: `
    SELECT
      (SELECT count(*) FROM contrato WHERE licitacao_id = $2 AND orgao_id = $1) AS contratos,
      (SELECT count(*) FROM ata_registro_precos WHERE licitacao_id = $2 AND orgao_id = $1) AS atas`,
  remover: `DELETE FROM licitacao WHERE orgao_id = $1 AND id = $2`,
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
  existeNumero = async (orgaoId: string, numero: string, ignorarId?: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeNumero, [orgaoId, numero, ignorarId ?? null]);
    return (rowCount ?? 0) > 0;
  };

  atualizar = async (orgaoId: string, id: string, dados: EdicaoLicitacao): Promise<void> => {
    await pool.query(SQL.atualizar, [
      orgaoId, id, dados.numero ?? null,
      dados.resumo !== undefined, dados.resumo ?? null,
      dados.objeto ?? null, dados.modalidade ?? null,
      dados.dataAssinatura ?? null, dados.valorTotal ?? null,
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

  remover = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.limparUnidades, [id]);
    await pool.query(SQL.remover, [orgaoId, id]);
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
